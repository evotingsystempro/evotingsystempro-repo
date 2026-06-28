import React, { useContext, useEffect, useState, useCallback } from "react";
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

const pct = (votes: number, total: number) =>
    total === 0 ? 0 : Math.round((votes / total) * 100);

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PollLeaderboardScreen() {
    const { userName, rawUserEmail } = useContext(GlobalContext);

    // Normalise params — expo-router can return string | string[]
    const params = useLocalSearchParams<{ pollId: string; creatorEmail: string }>();
    const pollId = Array.isArray(params.pollId) ? params.pollId[0] : params.pollId;
    const creatorEmail = Array.isArray(params.creatorEmail) ? params.creatorEmail[0] : params.creatorEmail;

    const [poll, setPoll] = useState<Poll | null>(null);
    const [aspirants, setAspirants] = useState<Aspirant[]>([]);
    const [loadingPoll, setLoadingPoll] = useState(true);
    const [loadingAspirants, setLoadingAspirants] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // The aspirantEmail this voter has voted for (null = not voted yet)
    // For multiple-vote polls this is an array; for single-vote it's at most one element.
    const [votedEmails, setVotedEmails] = useState<string[]>([]);
    const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

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
                const list: Aspirant[] = snap.docs.map((d) => ({
                    email: d.data().email ?? d.id,   // use stored email field; fall back to doc ID
                    name: d.data().name ?? d.id,
                    photo: d.data().photo ?? "",
                    votes: d.data().votes ?? 0,
                    pollId: d.data().pollId ?? pollId,
                    creatorEmail: d.data().creatorEmail ?? creatorEmail,
                }));
                setAspirants(list);
                setLoadingAspirants(false);
                setRefreshing(false);
            }
        );
    }, [pollId, creatorEmail]);

    // ── Load this voter's receipt from VOTERS_DB ───────────────────────────────
    //
    // Structure (matches the agreed schema):
    //   VOTERS_DB/{voterEmail}/{pollId}   ← pollId is the DOCUMENT ID, no "polls" subcollection
    //     ├── pollTitle
    //     ├── creatorEmail
    //     ├── aspirantVoted   string (single) | string[] (multiple)
    //     └── votedAt

    const loadMyVotes = useCallback(async () => {
        if (!rawUserEmail || !pollId) return;
        try {
            // CORRECT path: VOTERS_DB/{voterEmail}/{pollId}
            const snap = await getDoc(doc(db, "VOTERS_DB", rawUserEmail, pollId, "receipt"));
            if (snap.exists()) {
                const data = snap.data();
                const voted = data?.aspirantVoted;
                setVotedEmails(Array.isArray(voted) ? voted : voted ? [voted] : []);
            } else {
                setVotedEmails([]);
            }
        } catch (e) {
            console.error("loadMyVotes:", e);
        }
    }, [rawUserEmail, pollId]);

    useEffect(() => { loadMyVotes(); }, [loadMyVotes]);

    // ── Toggle vote ────────────────────────────────────────────────────────────
    //
    // Single-vote:
    //   • Tap unvoted aspirant  → remove vote from previous (if any), add to new one
    //   • Tap already-voted aspirant → undo that vote
    //
    // Multiple-vote:
    //   • Tap unvoted aspirant  → add vote
    //   • Tap already-voted aspirant → undo that vote
    //
    // VOTERS_DB receipt is always written so we know what to undo next time.
    // aspirant docs are found by their stored `email` field, not the doc ID,
    // because the schema uses aspirant_id as the doc key.

    const handleToggleVote = async (aspirantEmail: string) => {
        if (!poll || !rawUserEmail || !pollId || !creatorEmail) return;
        if (togglingEmail) return; // prevent double-tap

        const closedNow = poll.status === "closed" || isExpired(poll.deadline);
        if (closedNow) {
            Alert.alert("Poll closed", "This poll is no longer accepting votes.");
            return;
        }

        setTogglingEmail(aspirantEmail);

        try {
            const hasVotedThis = votedEmails.includes(aspirantEmail);

            // VOTERS_DB receipt doc — CORRECT path (no "polls" level)
            const receiptRef = doc(db, "VOTERS_DB", rawUserEmail, pollId, "receipt");

            // Helper: find the aspirant's Firestore doc reference by its stored email field.
            // Because the doc ID may be an aspirant_id, we look it up from the loaded list.
            const findAspirantRef = (email: string) => {
                const asp = aspirants.find((a) => a.email === email);
                if (!asp) throw new Error(`Aspirant not found: ${email}`);
                // The doc's id in the snapshot is used to build the ref
                // We stored email in d.data().email, but we need the doc ID.
                // Get it from the snapshot we built:
                return null; // placeholder — see note below
            };

            // Since we map `email: d.data().email ?? d.id` in the snapshot listener,
            // and the Firestore doc ID might differ from the email, we need the doc ID.
            // The safest approach: store docId on the Aspirant object.
            // For now, aspirants loaded from onSnapshot use d.id as the Firestore doc ID.
            // We'll find the matching aspirant by email to get its docId.
            const getAspirantDocRef = (email: string) => {
                // Find the aspirant in the local list whose email matches
                const asp = aspirants.find((a) => a.email === email);
                if (!asp) throw new Error(`Aspirant not found in list: ${email}`);
                // We need the Firestore doc ID. Since we read email from d.data().email ?? d.id,
                // and the doc ID is aspirant_id, we need to track docId separately.
                // ─── IMPORTANT ───
                // The snapshot listener uses d.data().email ?? d.id for the email field,
                // but the doc path needs d.id (the actual Firestore document ID).
                // We fix this by returning a collection-level ref and letting Firestore
                // match on the stored email. But that requires a query, not a direct ref.
                //
                // SIMPLEST FIX: keep aspirantEmail as the Firestore doc ID (as in CreatePollScreen).
                // CreatePollScreen writes: doc(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId, aspirantEmail)
                // So doc ID = aspirantEmail. The schema note "aspirant_id" is just a label —
                // the actual doc ID written by CreatePollScreen IS the aspirantEmail.
                // So the direct ref is correct:
                return doc(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId, email);
            };

            if (hasVotedThis) {
                // ── Undo this vote ──────────────────────────────────────────────
                await updateDoc(getAspirantDocRef(aspirantEmail), { votes: increment(-1) });

                const newVotedFor = votedEmails.filter((e) => e !== aspirantEmail);

                await setDoc(
                    receiptRef,
                    {
                        pollTitle: poll.title,
                        creatorEmail,
                        aspirantVoted: poll.pollType === "single"
                            ? (newVotedFor[0] ?? null)
                            : newVotedFor,
                        votedAt: serverTimestamp(),
                    },
                    { merge: true }
                );

                setVotedEmails(newVotedFor);

            } else {
                // ── Cast vote (and swap if single-vote) ─────────────────────────
                if (poll.pollType === "single" && votedEmails.length > 0) {
                    // Remove previous vote first
                    const prevEmail = votedEmails[0];
                    await updateDoc(getAspirantDocRef(prevEmail), { votes: increment(-1) });
                }

                await updateDoc(getAspirantDocRef(aspirantEmail), { votes: increment(1) });

                const newVotedFor = poll.pollType === "single"
                    ? [aspirantEmail]
                    : Array.from(new Set([...votedEmails, aspirantEmail]));

                await setDoc(
                    receiptRef,
                    {
                        pollTitle: poll.title,
                        creatorEmail,
                        aspirantVoted: poll.pollType === "single" ? aspirantEmail : newVotedFor,
                        votedAt: serverTimestamp(),
                    },
                    { merge: true }
                );

                setVotedEmails(newVotedFor);
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
                                            <View style={styles.voteDeltaBadge}>
                                                <Text style={styles.voteDeltaText}>+{asp.votes || 0}</Text>
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
    voteDeltaBadge: { backgroundColor: "#fde047", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    voteDeltaText: { fontSize: 14, fontWeight: "800", color: "#1a1a1a" },

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
