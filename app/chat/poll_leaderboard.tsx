import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from "react-native";
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import ReusableScreen from "@/components/ReusableScreen";
import { GlobalContext } from "@/context";
import { db } from "@/firebase";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    onSnapshot,
    increment,
    serverTimestamp,
} from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Aspirant {
    email: string;
    name: string;
    photo: string;
    votes: number;
    pollId: string;
    creatorEmail: string;
    lastVotedAt: Date | null;
}

interface Poll {
    pollId: string;
    title: string;
    pollType: "single" | "multiple";
    isAnonymous: boolean;
    showResults: boolean;
    deadline: string | null;
    status: "active" | "closed";
    creatorEmail: string;
    creatorName: string;
    aspirantCount: number;
    dateCreated: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isExpired = (deadline: string | null) =>
    deadline ? new Date(deadline) < new Date() : false;

const totalVotes = (aspirants: Aspirant[]) =>
    aspirants.reduce((s, a) => s + (a.votes || 0), 0);

const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    return new Date(deadline).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const RANK_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const AVATAR_COLORS = ["#9d174d", "#1f2937", "#9d174d", "#1F9F4E", "#2563eb", "#b45309"];

const timeAgo = (date: Date | null): string => {
    if (!date) return "no votes yet";
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 10) return "now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PollLeaderboardScreen() {
    const { userName, rawUserEmail } = useContext(GlobalContext);

    const params = useLocalSearchParams<{ pollId: string; creatorEmail: string }>();
    const pollId = Array.isArray(params.pollId) ? params.pollId[0] : params.pollId;
    const creatorEmail = Array.isArray(params.creatorEmail) ? params.creatorEmail[0] : params.creatorEmail;

    const [poll, setPoll] = useState<Poll | null>(null);
    const [aspirants, setAspirants] = useState<Aspirant[]>([]);
    const [loadingPoll, setLoadingPoll] = useState(true);
    const [loadingAspirants, setLoadingAspirants] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── votedEmails lives in BOTH state (for rendering) AND a ref (for handlers)
    // Without the ref, handleToggleVote captures a stale closure of votedEmails
    // after the aspirants onSnapshot fires a re-render — causing the "only first
    // vote works" bug.
    const [votedEmails, setVotedEmails] = useState<string[]>([]);
    const votedEmailsRef = useRef<string[]>([]);

    const syncVotedEmails = (emails: string[]) => {
        votedEmailsRef.current = emails;
        setVotedEmails(emails);
    };

    const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

    // Tick every 30 s so relative timestamps stay fresh
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // ── Poll metadata (real-time) ──────────────────────────────────────────────

    useEffect(() => {
        if (!pollId || !creatorEmail) return;
        return onSnapshot(
            doc(db, "POLL_TITLE_DB", creatorEmail, "polls", pollId),
            (snap) => {
                if (snap.exists()) setPoll(snap.data() as Poll);
                setLoadingPoll(false);
            }
        );
    }, [pollId, creatorEmail]);

    // ── Aspirants (real-time) ──────────────────────────────────────────────────

    useEffect(() => {
        if (!pollId || !creatorEmail) return;
        return onSnapshot(
            collection(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId),
            (snap) => {
                const list: Aspirant[] = snap.docs.map((d) => {
                    const raw = d.data().lastVotedAt;
                    return {
                        email: d.data().email ?? d.id,
                        name: d.data().name ?? d.id,
                        photo: d.data().photo ?? "",
                        votes: d.data().votes ?? 0,
                        pollId: d.data().pollId ?? pollId,
                        creatorEmail: d.data().creatorEmail ?? creatorEmail,
                        lastVotedAt: raw?.toDate ? raw.toDate() : null,
                    };
                });
                setAspirants(list);
                setLoadingAspirants(false);
                setRefreshing(false);
            }
        );
    }, [pollId, creatorEmail]);

    // ── Load voter's receipt from VOTERS_DB ───────────────────────────────────
    //
    // Path: VOTERS_DB/{voterEmail}/votes/{pollId}
    //   (4 segments: col / doc / col / doc — valid Firestore alternation)
    //
    //   ├── pollTitle
    //   ├── creatorEmail
    //   ├── aspirantVoted   string (single) | string[] (multiple)
    //   └── votedAt

    const receiptPath = useCallback(() => {
        if (!rawUserEmail || !pollId) return null;
        return doc(db, "VOTERS_DB", rawUserEmail, "votes", pollId);
    }, [rawUserEmail, pollId]);

    const loadMyVotes = useCallback(async () => {
        const ref = receiptPath();
        if (!ref) return;
        try {
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const voted = snap.data()?.aspirantVoted;
                syncVotedEmails(
                    Array.isArray(voted) ? voted : voted ? [voted] : []
                );
            } else {
                syncVotedEmails([]);
            }
        } catch (e) {
            console.error("loadMyVotes:", e);
        }
    }, [receiptPath]);

    useEffect(() => { loadMyVotes(); }, [loadMyVotes]);

    // ── Aspirant doc ref (CreatePollScreen uses aspirantEmail as the doc ID) ──

    const aspirantRef = (email: string) =>
        doc(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId, email);

    // ── Toggle vote ────────────────────────────────────────────────────────────
    //
    // Always reads votedEmailsRef.current — never the stale closure value.
    //
    // Single-vote:
    //   tap new aspirant  → decrement previous (if any) + increment new
    //   tap same aspirant → decrement it (undo)
    //
    // Multiple-vote:
    //   tap unvoted       → increment
    //   tap voted         → decrement (undo)

    const handleToggleVote = async (aspirantEmail: string) => {
        if (!poll || !rawUserEmail || !pollId || !creatorEmail) return;
        if (togglingEmail) return;

        if (poll.status === "closed" || isExpired(poll.deadline)) {
            Alert.alert("Poll closed", "This poll is no longer accepting votes.");
            return;
        }

        // ── Read from ref, not state — avoids stale closure ──
        const currentVoted = votedEmailsRef.current;
        const hasVotedThis = currentVoted.includes(aspirantEmail);

        setTogglingEmail(aspirantEmail);

        try {
            const receipt = receiptPath()!;

            if (hasVotedThis) {
                // ── Undo vote ────────────────────────────────────────────────
                await updateDoc(aspirantRef(aspirantEmail), {
                    votes: increment(-1),
                    lastVotedAt: serverTimestamp(),
                });

                const newVoted = currentVoted.filter((e) => e !== aspirantEmail);
                await setDoc(receipt, {
                    pollTitle: poll.title,
                    creatorEmail,
                    aspirantVoted: poll.pollType === "single"
                        ? (newVoted[0] ?? null)
                        : newVoted,
                    votedAt: serverTimestamp(),
                }, { merge: true });

                syncVotedEmails(newVoted);

            } else {
                // ── Cast vote ────────────────────────────────────────────────
                if (poll.pollType === "single" && currentVoted.length > 0) {
                    // Swap: remove previous vote first
                    await updateDoc(aspirantRef(currentVoted[0]), {
                        votes: increment(-1),
                        lastVotedAt: serverTimestamp(),
                    });
                }

                await updateDoc(aspirantRef(aspirantEmail), {
                    votes: increment(1),
                    lastVotedAt: serverTimestamp(),
                });

                const newVoted = poll.pollType === "single"
                    ? [aspirantEmail]
                    : Array.from(new Set([...currentVoted, aspirantEmail]));

                await setDoc(receipt, {
                    pollTitle: poll.title,
                    creatorEmail,
                    aspirantVoted: poll.pollType === "single" ? aspirantEmail : newVoted,
                    votedAt: serverTimestamp(),
                }, { merge: true });

                syncVotedEmails(newVoted);
            }

        } catch (err) {
            console.error("handleToggleVote:", err);
            Alert.alert("Error", `Could not update your vote.\n\n${String(err)}`);
        } finally {
            setTogglingEmail(null);
        }
    };

    const onRefresh = () => { setRefreshing(true); loadMyVotes(); };

    // ── Derived ────────────────────────────────────────────────────────────────

    const alreadyVoted = votedEmails.length > 0;
    const expired = isExpired(poll?.deadline ?? null);
    const closed = poll?.status === "closed" || expired;
    const canVote = !closed;

    const sorted = [...aspirants].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const total = totalVotes(aspirants);
    const loading = loadingPoll || loadingAspirants;

    // ── Loading ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <ReusableScreen>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={18} color="#1F9F4E" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    <View style={{ width: 32 }} />
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#1F9F4E" />
                    <Text style={styles.loadingText}>Loading leaderboard…</Text>
                </View>
            </ReusableScreen>
        );
    }

    if (!poll) {
        return (
            <ReusableScreen>
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyText}>Poll not found.</Text>
                </View>
            </ReusableScreen>
        );
    }

    // ── UI ─────────────────────────────────────────────────────────────────────

    return (
        <ReusableScreen>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={18} color="#1F9F4E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{poll.title}</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={{ flex: 1, backgroundColor: "#fff", margin: 5, borderRadius: 12, overflow: "hidden" }}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                            tintColor="#1F9F4E" colors={["#1F9F4E"]} />
                    }
                >
                    {/* ── Status row ── */}
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, closed ? styles.badgeClosed : styles.badgeActive]}>
                            <View style={[styles.statusDot, closed ? styles.dotClosed : styles.dotActive]} />
                            <Text style={[styles.statusText, closed ? styles.statusTextClosed : styles.statusTextActive]}>
                                {closed ? (expired ? "Expired" : "Closed") : "Live"}
                            </Text>
                        </View>
                        <View style={styles.metaChip}>
                            <MaterialIcons name="how-to-vote" size={13} color="#6b7280" />
                            <Text style={styles.metaChipText}>{total} vote{total !== 1 ? "s" : ""}</Text>
                        </View>
                        <View style={styles.metaChip}>
                            <Ionicons name="people-outline" size={13} color="#6b7280" />
                            <Text style={styles.metaChipText}>
                                {aspirants.length} aspirant{aspirants.length !== 1 ? "s" : ""}
                            </Text>
                        </View>
                        {poll.deadline && (
                            <View style={styles.metaChip}>
                                <Ionicons name="time-outline" size={13} color="#6b7280" />
                                <Text style={styles.metaChipText}>{formatDeadline(poll.deadline)}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.divider} />

                    {/* ── Aspirant cards ── */}
                    {sorted.length === 0 ? (
                        <View style={styles.emptyAspirantsWrap}>
                            <Ionicons name="people-outline" size={36} color="#d1d5db" />
                            <Text style={styles.emptyText}>No aspirants registered yet.</Text>
                        </View>
                    ) : (
                        <View style={styles.cardsWrap}>
                            {sorted.map((asp, index) => {
                                const hasVotedThis = votedEmails.includes(asp.email);
                                const isToggling = togglingEmail === asp.email;
                                const rankLabel = RANK_LABELS[index] ?? `${index + 1}th`;
                                const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

                                return (
                                    <View key={asp.email} style={styles.card}>
                                        {/* Top row */}
                                        <View style={styles.cardTopRow}>
                                            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                                                <Text style={styles.avatarText}>
                                                    {asp.name.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={styles.cardNameBlock}>
                                                <Text style={styles.cardName} numberOfLines={1}>{asp.name}</Text>
                                                <Text style={styles.cardEmail} numberOfLines={1}>{asp.email}</Text>
                                            </View>
                                            <View style={styles.timeBadge}>
                                                <Ionicons name="time-outline" size={11} color="#6b7280" />
                                                <Text style={styles.timeText}>
                                                    {timeAgo(asp.lastVotedAt)}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Middle row */}
                                        <View style={styles.cardMiddleRow}>
                                            <Text style={styles.rankLabel}>{rankLabel}</Text>
                                            <View style={styles.pointsCircle}>
                                                <Text style={styles.pointsCircleText}>{asp.votes || 0}</Text>
                                            </View>
                                            <Text style={styles.pointsLabel}>Votes</Text>
                                            <View style={{ flex: 1 }} />

                                            {isToggling ? (
                                                <ActivityIndicator size="small"
                                                    color={hasVotedThis ? "#1F9F4E" : "#9b9b9b"}
                                                    style={{ marginRight: 8 }} />
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => handleToggleVote(asp.email)}
                                                    disabled={!canVote || !!togglingEmail}
                                                    activeOpacity={0.7}
                                                    style={styles.thumbBtn}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <AntDesign
                                                        name="like1"
                                                        size={25}
                                                        color={hasVotedThis ? "#1F9F4E" : "#9b9b9b"}
                                                    />
                                                    <Text style={[styles.thumbCount, hasVotedThis && styles.thumbCountActive]}>
                                                        {hasVotedThis ? 1 : 0}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.divider} />

                    {/* ── Notices ── */}
                    {alreadyVoted && (
                        <View style={styles.noticeRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#1F9F4E" />
                            <Text style={styles.noticeText}>
                                {poll.pollType === "single"
                                    ? "Tap another aspirant to switch your vote, or tap again to remove it."
                                    : "Tap an aspirant again to remove that vote."}
                            </Text>
                        </View>
                    )}

                    {closed && (
                        <View style={[styles.noticeRow, styles.noticeRowClosed]}>
                            <Ionicons name="lock-closed-outline" size={16} color="#ef4444" />
                            <Text style={[styles.noticeText, styles.noticeTextClosed]}>
                                {expired ? "This poll has expired." : "This poll is now closed."}
                            </Text>
                        </View>
                    )}

                    {/* ── Footer meta ── */}
                    <View style={styles.footerMeta}>
                        <Text style={styles.footerMetaText}>Created by {poll.creatorName}</Text>
                        {poll.isAnonymous && (
                            <View style={styles.anonBadge}>
                                <Ionicons name="eye-off-outline" size={11} color="#6b7280" />
                                <Text style={styles.anonText}>Anonymous voting</Text>
                            </View>
                        )}
                        <Text style={styles.footerMetaText}>
                            {poll.pollType === "single" ? "Single-vote poll" : "Multiple-vote poll"}
                        </Text>
                    </View>
                </ScrollView>
            </View>
        </ReusableScreen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontSize: 14, color: "#9ca3af" },
    emptyText: { fontSize: 15, color: "#9ca3af", marginTop: 8, textAlign: "center" },

    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: "#e5e7eb",
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#EAF6EE",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: "700",
        color: "#1a1a1a",
        textAlign: "center",
        marginHorizontal: 8,
        letterSpacing: -0.2,
    },

    scroll: { flex: 1, backgroundColor: "#eee", margin: 5 },
    scrollContent: { paddingBottom: 20 },

    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 7,
        backgroundColor: "#fff",
        flexWrap: "wrap",
    },
    statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
    badgeActive: { backgroundColor: "#EAF6EE" },
    badgeClosed: { backgroundColor: "#fee2e2" },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    dotActive: { backgroundColor: "#1F9F4E" },
    dotClosed: { backgroundColor: "#ef4444" },
    statusText: { fontSize: 13, fontWeight: "600" },
    statusTextActive: { color: "#1F9F4E" },
    statusTextClosed: { color: "#ef4444" },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaChipText: { fontSize: 13, color: "#6b7280" },

    divider: { height: 0.5, backgroundColor: "#e5e7eb" },

    cardsWrap: { paddingHorizontal: 3 },

    card: {
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: "#ddd",
        marginBottom: 6,
    },
    cardTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
    cardNameBlock: { flex: 1, gap: 2 },
    cardName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
    cardEmail: { fontSize: 12, color: "#9ca3af" },

    timeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#f3f4f6",
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 20,
    },
    timeText: { fontSize: 11, fontWeight: "600", color: "#6b7280" },

    cardMiddleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
    rankLabel: { fontSize: 15, fontWeight: "600", color: "#6b7280", width: 36 },
    pointsCircle: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "#e0efe5ff",
        alignItems: "center",
        justifyContent: "center",
    },
    pointsCircleText: { fontSize: 30, fontWeight: "800", color: "#15803d" },
    pointsLabel: { fontSize: 14, color: "#374151", marginLeft: 6 },

    thumbBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 16 },
    thumbCount: { fontSize: 13, fontWeight: "600", color: "#9b9b9b" },
    thumbCountActive: { color: "#1F9F4E" },

    noticeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#EAF6EE",
    },
    noticeRowClosed: { backgroundColor: "#fee2e2" },
    noticeText: { fontSize: 13, color: "#1F9F4E", flex: 1, fontWeight: "500" },
    noticeTextClosed: { color: "#ef4444" },

    footerMeta: { alignItems: "center", paddingHorizontal: 16, paddingTop: 24, gap: 4 },
    footerMetaText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
    anonBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    anonText: { fontSize: 12, color: "#6b7280" },

    emptyAspirantsWrap: { alignItems: "center", paddingVertical: 40, gap: 10, backgroundColor: "#fff" },
});
