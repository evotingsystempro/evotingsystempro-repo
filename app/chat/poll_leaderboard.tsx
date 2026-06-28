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
    doc, getDoc, setDoc, updateDoc,
    collection, onSnapshot, increment, serverTimestamp,
} from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Aspirant {
    email: string;
    name: string;
    photo: string;
    votes: number;
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
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
};

const RANK_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const AVATAR_COLORS = ["#9d174d", "#1f2937", "#1F9F4E", "#2563eb", "#b45309", "#7c3aed"];

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
    const { rawUserEmail } = useContext(GlobalContext);

    const params = useLocalSearchParams<{ pollId: string; creatorEmail: string }>();
    const pollId = Array.isArray(params.pollId) ? params.pollId[0] : params.pollId;
    const creatorEmail = Array.isArray(params.creatorEmail) ? params.creatorEmail[0] : params.creatorEmail;

    const [poll, setPoll] = useState<Poll | null>(null);
    const [aspirants, setAspirants] = useState<Aspirant[]>([]);
    const [loadingPoll, setLoadingPoll] = useState(true);
    const [loadingAspirants, setLoadingAspirants] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── togglingEmail: state + ref so async guards never read stale values ─────
    const [togglingEmail, setTogglingEmail] = useState<string | null>(null);
    const togglingEmailRef = useRef<string | null>(null);
    const setTogglingEmailSafe = (val: string | null) => {
        togglingEmailRef.current = val;
        setTogglingEmail(val);
    };

    // ── votedEmails: state + ref so async handlers never read stale values ─────
    const [votedEmails, setVotedEmails] = useState<string[]>([]);
    const votedEmailsRef = useRef<string[]>([]);
    const syncVotedEmails = useCallback((next: string[]) => {
        votedEmailsRef.current = next;
        setVotedEmails(next);
    }, []);

    // Tick every 30 s so timeAgo labels refresh automatically
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // ── Poll metadata (live) ──────────────────────────────────────────────────

    useEffect(() => {
        if (!pollId || !creatorEmail) return;
        return onSnapshot(
            doc(db, "POLL_TITLE_DB", creatorEmail, "polls", pollId),
            (snap) => {
                if (snap.exists()) setPoll(snap.data() as Poll);
                setLoadingPoll(false);
            },
            (err) => { console.error("poll listener:", err); setLoadingPoll(false); }
        );
    }, [pollId, creatorEmail]);

    // ── Aspirants (live) ──────────────────────────────────────────────────────

    useEffect(() => {
        if (!pollId || !creatorEmail) return;
        return onSnapshot(
            collection(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId),
            (snap) => {
                setAspirants(snap.docs.map(d => {
                    const data = d.data();
                    const raw = data.lastVotedAt;
                    return {
                        email: data.email ?? d.id,
                        name: data.name ?? d.id,
                        photo: data.photo ?? "",
                        votes: data.votes ?? 0,
                        lastVotedAt: raw?.toDate ? raw.toDate() : null,
                    };
                }));
                setLoadingAspirants(false);
                setRefreshing(false);
            },
            (err) => { console.error("aspirants listener:", err); setLoadingAspirants(false); }
        );
    }, [pollId, creatorEmail]);

    // ── Load my existing vote ─────────────────────────────────────────────────
    // Path: VOTERS_DB/{voterEmail}/{pollId}/receipt

    const loadMyVotes = useCallback(async () => {
        if (!rawUserEmail || !pollId) return;
        try {
            const snap = await getDoc(doc(db, "VOTERS_DB", rawUserEmail, pollId, "receipt"));
            if (snap.exists()) {
                const voted = snap.data()?.aspirantVoted;
                if (Array.isArray(voted)) {
                    syncVotedEmails(voted.filter(Boolean));
                } else if (voted) {
                    syncVotedEmails([voted]);
                } else {
                    syncVotedEmails([]);
                }
            } else {
                syncVotedEmails([]);
            }
        } catch (e) {
            console.error("loadMyVotes:", e);
            syncVotedEmails([]);
        }
    }, [rawUserEmail, pollId, syncVotedEmails]);

    useEffect(() => { loadMyVotes(); }, [loadMyVotes]);

    // ── Toggle vote ───────────────────────────────────────────────────────────

    const handleToggleVote = async (aspirantEmail: string) => {
        console.log("TAP →", aspirantEmail, "| togglingEmail:", togglingEmailRef.current, "| canVote:", !closed);

        if (!poll || !rawUserEmail || !pollId || !creatorEmail) {
            Alert.alert("Not ready", "Please wait a moment and try again.");
            return;
        }

        // Guard reads from ref — never stale
        if (togglingEmailRef.current) return;

        if (poll.status === "closed" || isExpired(poll.deadline)) {
            Alert.alert("Poll closed", "This poll is no longer accepting votes.");
            return;
        }

        // Read from ref — closures over state can be stale
        const current = votedEmailsRef.current;
        const hasVotedThis = current.includes(aspirantEmail);

        console.log("handleToggleVote →", { aspirantEmail, current, hasVotedThis, pollType: poll.pollType });

        setTogglingEmailSafe(aspirantEmail);

        // All refs built fresh inside the call — never from stale outer constants
        const aspirantRef = (email: string) =>
            doc(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId, email);

        // VOTERS_DB/{voterEmail}/{pollId}/receipt
        const voterDocRef = doc(db, "VOTERS_DB", rawUserEmail, pollId, "receipt");

        try {
            if (hasVotedThis) {
                // ── Remove vote ───────────────────────────────────────────────
                await updateDoc(aspirantRef(aspirantEmail), {
                    votes: increment(-1),
                    lastVotedAt: serverTimestamp(),
                });

                const next = current.filter(e => e !== aspirantEmail);

                await setDoc(voterDocRef, {
                    pollTitle: poll.title,
                    creatorEmail,
                    aspirantVoted: poll.pollType === "single" ? (next[0] ?? null) : next,
                    votedAt: serverTimestamp(),
                }, { merge: true });

                syncVotedEmails(next);

            } else {
                // ── Cast vote ─────────────────────────────────────────────────
                if (poll.pollType === "single" && current.length > 0) {
                    console.log("Swapping vote:", current[0], "→", aspirantEmail);
                    await updateDoc(aspirantRef(current[0]), {
                        votes: increment(-1),
                        lastVotedAt: serverTimestamp(),
                    });
                }

                await updateDoc(aspirantRef(aspirantEmail), {
                    votes: increment(1),
                    lastVotedAt: serverTimestamp(),
                });

                const next = poll.pollType === "single"
                    ? [aspirantEmail]
                    : Array.from(new Set([...current, aspirantEmail]));

                await setDoc(voterDocRef, {
                    pollTitle: poll.title,
                    creatorEmail,
                    aspirantVoted: poll.pollType === "single" ? aspirantEmail : next,
                    votedAt: serverTimestamp(),
                }, { merge: true });

                syncVotedEmails(next);
            }

        } catch (err: any) {
            console.error("handleToggleVote error:", err);
            Alert.alert("Vote failed", err?.message ?? "Could not update vote. Please try again.");
            await loadMyVotes();
        } finally {
            setTogglingEmailSafe(null);
        }
    };

    const onRefresh = () => { setRefreshing(true); loadMyVotes(); };

    // Add this ref alongside the others at the top of the component
    const sortedRef = useRef<Aspirant[]>([]);

    // ── Derived ───────────────────────────────────────────────────

    const alreadyVoted = votedEmails.length > 0;
    const expired = isExpired(poll?.deadline ?? null);
    const closed = poll?.status === "closed" || expired;
    const canVote = !closed;
    const total = totalVotes(aspirants);
    const loading = loadingPoll || loadingAspirants;

    // Only re-sort when no vote operation is in flight —
    // prevents the card list jumping and spinner appearing on wrong card
    const sorted = (() => {
        if (togglingEmailRef.current) return sortedRef.current;
        const next = [...aspirants].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        sortedRef.current = next;
        return next;
    })();

    // ── Loading ───────────────────────────────────────────────

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

    // ── Render ────────────────────────────────────────────────────────────────

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

            <View style={styles.body}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                            tintColor="#1F9F4E" colors={["#1F9F4E"]} />
                    }
                >
                    {/* Status row */}
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

                    {/* Aspirant cards */}
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
                                                <Text style={styles.timeBadgeText}>{timeAgo(asp.lastVotedAt)}</Text>
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
                                                <ActivityIndicator
                                                    size="small"
                                                    color={hasVotedThis ? "#1F9F4E" : "#9b9b9b"}
                                                    style={{ marginRight: 8 }}
                                                />
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => handleToggleVote(asp.email)}
                                                    // Use ref for disabled check — state can be stale
                                                    disabled={!canVote || !!togglingEmailRef.current}
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

                    {/* Notices */}
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

                    {/* Footer */}
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
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb",
    },
    backBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "#EAF6EE", alignItems: "center", justifyContent: "center",
    },
    headerTitle: {
        flex: 1, fontSize: 17, fontWeight: "700", color: "#1a1a1a",
        textAlign: "center", marginHorizontal: 8, letterSpacing: -0.2,
    },

    body: { flex: 1, backgroundColor: "#fff", margin: 5, borderRadius: 12, overflow: "hidden" },
    scroll: { flex: 1, backgroundColor: "#eee", margin: 5 },
    scrollContent: { paddingBottom: 20 },

    statusRow: {
        flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
        paddingHorizontal: 16, paddingVertical: 12, marginBottom: 7, backgroundColor: "#fff",
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
        backgroundColor: "#fff", borderRadius: 18, padding: 14,
        borderWidth: 1, borderColor: "#ddd", marginBottom: 6,
    },
    cardTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
    cardNameBlock: { flex: 1, gap: 2 },
    cardName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
    cardEmail: { fontSize: 12, color: "#9ca3af" },

    timeBadge: {
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20,
    },
    timeBadgeText: { fontSize: 11, fontWeight: "600", color: "#6b7280" },

    cardMiddleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
    rankLabel: { fontSize: 15, fontWeight: "600", color: "#6b7280", width: 36 },
    pointsCircle: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: "#e0efe5ff", alignItems: "center", justifyContent: "center",
    },
    pointsCircleText: { fontSize: 30, fontWeight: "800", color: "#15803d" },
    pointsLabel: { fontSize: 14, color: "#374151", marginLeft: 6 },

    thumbBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 16 },
    thumbCount: { fontSize: 13, fontWeight: "600", color: "#9b9b9b" },
    thumbCountActive: { color: "#1F9F4E" },

    noticeRow: {
        flexDirection: "row", alignItems: "center", gap: 8,
        marginHorizontal: 16, marginTop: 16, padding: 12,
        borderRadius: 10, backgroundColor: "#EAF6EE",
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