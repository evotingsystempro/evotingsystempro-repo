import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    LayoutAnimation,
    UIManager,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import ReusableScreen from "@/components/ReusableScreen";
import { db } from "@/firebase";
import { collectionGroup, getDocs } from "firebase/firestore";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PollSummary {
    pollId: string;
    title: string;
    pollType: "single" | "multiple";
    status: "active" | "closed";
    deadline: string | null;
    creatorEmail: string;
    creatorName: string;
    aspirantCount: number;
    dateCreated: string;
    createdAt: number;              // epoch ms — used for reliable sorting
    showResults: boolean;
    isAnonymous: boolean;
}

interface CreatorGroup {
    creatorEmail: string;
    creatorName: string;
    polls: PollSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isExpired = (deadline: string | null) =>
    deadline ? new Date(deadline) < new Date() : false;

const isPollClosed = (p: PollSummary) =>
    p.status === "closed" || isExpired(p.deadline);

// dateCreated is already a human-readable locale string — return as-is
const formatDate = (dateStr: string) => dateStr;

const AVATAR_PALETTE = ["#1F9F4E", "#2563EB", "#D97706", "#7C3AED", "#DB2777", "#0D9488"];
const avatarColorFor = (key: string) => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PollsListScreen() {
    const [groups, setGroups] = useState<CreatorGroup[]>([]);
    const [filtered, setFiltered] = useState<CreatorGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    // ── Fetch all poll docs via collectionGroup query ─────────────────────────

    const fetchPolls = useCallback(async () => {
        try {
            const pollsSnap = await getDocs(collectionGroup(db, "polls"));

            const byCreator = new Map<string, PollSummary[]>();
            const creatorNames = new Map<string, string>();

            pollsSnap.docs.forEach((pd) => {
                const d = pd.data();
                const creatorEmail: string = d.creatorEmail ?? pd.ref.parent.parent?.id ?? "unknown";
                const creatorName: string = d.creatorName ?? "Unknown";

                const summary: PollSummary = {
                    pollId: d.pollId ?? pd.id,
                    title: d.title ?? "Untitled Poll",
                    pollType: d.pollType ?? "single",
                    status: d.status ?? "active",
                    deadline: d.deadline ?? null,
                    creatorEmail,
                    creatorName,
                    aspirantCount: d.aspirantCount ?? 0,
                    dateCreated: d.dateCreated ?? "",
                    createdAt: d.createdAt?.toMillis?.() ?? 0,  // Firestore timestamp → ms
                    showResults: d.showResults ?? true,
                    isAnonymous: d.isAnonymous ?? false,
                };

                if (!byCreator.has(creatorEmail)) byCreator.set(creatorEmail, []);
                byCreator.get(creatorEmail)!.push(summary);
                creatorNames.set(creatorEmail, creatorName);
            });

            const groupList: CreatorGroup[] = Array.from(byCreator.entries()).map(
                ([creatorEmail, polls]) => {
                    // Sort newest first using epoch ms — locale strings are not reliable
                    polls.sort((a, b) => b.createdAt - a.createdAt);
                    return {
                        creatorEmail,
                        creatorName: creatorNames.get(creatorEmail) ?? "Unknown",
                        polls,
                    };
                }
            );

            groupList.sort((a, b) => a.creatorName.localeCompare(b.creatorName));
            setGroups(groupList);
            applyFilters(groupList, search, filter);
        } catch (err) {
            console.error("fetchPolls:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchPolls(); }, [fetchPolls]);

    // ── Filter / search ───────────────────────────────────────────────────────

    const applyFilters = (
        source: CreatorGroup[],
        q: string,
        f: "all" | "active" | "closed"
    ) => {
        const term = q.toLowerCase().trim();
        const result: CreatorGroup[] = [];
        for (const group of source) {
            const polls = group.polls.filter((p) => {
                const matchSearch =
                    !term ||
                    p.title.toLowerCase().includes(term) ||
                    group.creatorName.toLowerCase().includes(term);
                const matchFilter =
                    f === "all" ||
                    (f === "active" && !isPollClosed(p)) ||
                    (f === "closed" && isPollClosed(p));
                return matchSearch && matchFilter;
            });
            if (polls.length > 0) result.push({ ...group, polls });
        }
        setFiltered(result);
    };

    useEffect(() => {
        applyFilters(groups, search, filter);
    }, [search, filter, groups]);

    const onRefresh = () => { setRefreshing(true); fetchPolls(); };

    const openPoll = (poll: PollSummary) => {
        router.navigate({
            pathname: "./poll_leaderboard",
            params: { pollId: poll.pollId, creatorEmail: poll.creatorEmail },
        });
    };

    const toggleGroup = (creatorEmail: string) => {
        if (Platform.OS !== "web") {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(creatorEmail)) next.delete(creatorEmail);
            else next.add(creatorEmail);
            return next;
        });
    };

    // ── Derived counts ────────────────────────────────────────────────────────

    const totalPolls = filtered.reduce((s, g) => s + g.polls.length, 0);
    const livePolls = filtered.reduce(
        (s, g) => s + g.polls.filter((p) => !isPollClosed(p)).length, 0
    );

    // ── Loading ───────────────────────────────────────────────────────────────

    const truncateMiddle = useCallback(
        (value?: string, start = 6, end = 6): string | undefined => {
            if (!value || value.length <= start + end) return value;
            return `${value.slice(0, start)}…${value.slice(-end)}`;
        },
        []
    );

    if (loading) {
        return (
            <ReusableScreen>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={18} color="#1F9F4E" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>All Polls</Text>
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#1F9F4E" />
                    <Text style={styles.loadingText}>Loading polls…</Text>
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
                <Text style={styles.headerTitle}>All Polls</Text>
                <View style={styles.headerCountPill}>
                    <Text style={styles.headerCountText}>{totalPolls}</Text>
                </View>
            </View>

            {/* Search bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchWrap}>
                    <Ionicons name="search-outline" size={17} color="#9ca3af" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search polls or creators…"
                        placeholderTextColor="#484747ff"
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                        {...(Platform.OS === "web" && { outlineStyle: "none" } as any)}
                    />
                    {search.length > 0 && Platform.OS !== "ios" && (
                        <TouchableOpacity
                            onPress={() => setSearch("")}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close-circle" size={17} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter tabs */}
                <View style={styles.filterRow}>
                    <View style={styles.filterPillGroup}>
                        {(["all", "active", "closed"] as const).map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                                onPress={() => setFilter(f)}
                                activeOpacity={0.7}
                            >
                                {f === "active" && (
                                    <View style={[styles.filterDot, filter === f && styles.filterDotActiveOn]} />
                                )}
                                <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {livePolls > 0 && filter === "all" && (
                        <View style={styles.liveBadge}>
                            <View style={styles.liveBadgeDot} />
                            <Text style={styles.liveBadgeText}>{livePolls} live</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* List */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    filtered.length === 0 && styles.scrollEmpty,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#1F9F4E"
                        colors={["#1F9F4E"]}
                    />
                }
            >
                {filtered.length === 0 ? (
                    <View style={styles.emptyWrap}>
                        <View style={styles.emptyIconWrap}>
                            <MaterialIcons name="ballot" size={40} color="#c9cfd6" />
                        </View>
                        <Text style={styles.emptyTitle}>No polls found</Text>
                        <Text style={styles.emptyDesc}>
                            {search
                                ? "Try a different search term."
                                : "No polls have been created yet."}
                        </Text>
                    </View>
                ) : (
                    filtered.map((group) => {
                        const isCollapsed = collapsed.has(group.creatorEmail);
                        const liveInGroup = group.polls.filter((p) => !isPollClosed(p)).length;
                        const avatarColor = avatarColorFor(group.creatorEmail);

                        return (
                            <View key={group.creatorEmail} style={styles.groupCard}>
                                {/* Creator header — tappable to collapse */}
                                <TouchableOpacity
                                    style={styles.creatorHeader}
                                    onPress={() => toggleGroup(group.creatorEmail)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[styles.creatorAvatar, { backgroundColor: avatarColor }]}>
                                        <Text style={styles.creatorAvatarText}>
                                            {group.creatorName.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.creatorInfo}>
                                        <Text style={styles.creatorName} numberOfLines={1}>
                                            <Text style={{ color: "#e70a9dff", fontSize: 12 }}>CREATOR: </Text>{group.creatorName}
                                        </Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 }}>
                                            <Text style={styles.creatorEmail} numberOfLines={1}>
                                                {truncateMiddle(group.creatorEmail, 0, 17)}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: "#1F9F4E", padding: 12, borderRadius: 14, fontWeight: "500", paddingVertical: 3, backgroundColor: "#e0f7fa" }}>
                                                Verified
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.creatorRight}>
                                        {liveInGroup > 0 && (
                                            <View style={styles.miniLiveDot} />
                                        )}
                                        <Text style={styles.creatorPollCount}>
                                            {group.polls.length}
                                        </Text>
                                        <Ionicons
                                            name={isCollapsed ? "chevron-down" : "chevron-up"}
                                            size={16}
                                            color="#9ca3af"
                                        />
                                    </View>
                                </TouchableOpacity>

                                {/* Poll rows */}
                                {!isCollapsed && (
                                    <View style={styles.pollsWrap}>
                                        {group.polls.map((poll) => {
                                            const closed = isPollClosed(poll);
                                            const expired = isExpired(poll.deadline);
                                            return (
                                                <TouchableOpacity
                                                    key={poll.pollId}
                                                    style={styles.pollCard}
                                                    onPress={() => openPoll(poll)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={[
                                                        styles.statusRail,
                                                        closed ? styles.railClosed : styles.railActive,
                                                    ]} />

                                                    <View style={styles.pollInfo}>
                                                        <View style={styles.pollTitleRow}>
                                                            <Text style={styles.pollTitle} numberOfLines={2}>
                                                                {poll.title}
                                                            </Text>
                                                            <View style={[
                                                                styles.statusBadge,
                                                                closed ? styles.badgeClosed : styles.badgeActive,
                                                            ]}>
                                                                <Text style={[
                                                                    styles.badgeText,
                                                                    closed ? styles.badgeTextClosed : styles.badgeTextActive,
                                                                ]}>
                                                                    {closed ? (expired ? "Expired" : "Closed") : "Live"}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <View style={styles.pollMeta}>
                                                            <View style={styles.metaChip}>
                                                                <Ionicons name="people-outline" size={12} color="#6b7280" />
                                                                <Text style={styles.metaChipText}>
                                                                    {poll.aspirantCount} aspirant{poll.aspirantCount !== 1 ? "s" : ""}
                                                                </Text>
                                                            </View>
                                                            {poll.pollType === "multiple" && (
                                                                <View style={styles.metaChip}>
                                                                    <Ionicons name="layers-outline" size={12} color="#6b7280" />
                                                                    <Text style={styles.metaChipText}>Multi-vote</Text>
                                                                </View>
                                                            )}
                                                            {poll.isAnonymous && (
                                                                <View style={styles.metaChip}>
                                                                    <Ionicons name="eye-off-outline" size={12} color="#6b7280" />
                                                                    <Text style={styles.metaChipText}>Anonymous</Text>
                                                                </View>
                                                            )}
                                                        </View>

                                                        <View style={styles.pollFooterRow}>
                                                            {poll.dateCreated ? (
                                                                <Text style={styles.pollDate}>
                                                                    {formatDate(poll.dateCreated)}
                                                                </Text>
                                                            ) : <View />}
                                                            <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </ReusableScreen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontSize: 14, color: "#9ca3af" },

    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 14 : 12,
        // borderBottomWidth: 0.5, borderBottomColor: "#000",
    },
    backBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "#EAF6EE", alignItems: "center", justifyContent: "center",
    },
    headerTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", letterSpacing: -0.2 },
    headerCountPill: {
        minWidth: 30, height: 24, paddingHorizontal: 8, borderRadius: 12,
        backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
    },
    headerCountText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },

    searchSection: {
        backgroundColor: "#fff",
        borderBottomWidth: 1, borderBottomColor: "#ccc",
        paddingBottom: 10,
    },
    searchWrap: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#eee", borderRadius: 50,
        marginHorizontal: 16, marginTop: 4,
        paddingHorizontal: 12, paddingVertical: 9, marginBottom: 4,
    },
    searchInput: {
        flex: 1, fontSize: 15, color: "#1a1a1a",
        paddingVertical: Platform.OS === "ios" ? 0 : 2,
        ...(Platform.OS === "web" && { outlineStyle: "none" } as any),
    },

    filterRow: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 10, gap: 8,
    },
    filterPillGroup: { flexDirection: "row", gap: 6 },
    filterTab: {
        flexDirection: "row", alignItems: "center", gap: 5,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f3f4f6",
    },
    filterTabActive: { backgroundColor: "#1F9F4E" },
    filterTabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
    filterTabTextActive: { color: "#fff" },
    filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#9ca3af" },
    filterDotActiveOn: { backgroundColor: "#fff" },

    liveBadge: {
        flexDirection: "row", alignItems: "center", gap: 5,
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: "#EAF6EE",
    },
    liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1F9F4E" },
    liveBadgeText: { fontSize: 11, fontWeight: "700", color: "#1F9F4E" },

    scroll: { flex: 1, backgroundColor: "#e2e1e1ff", margin: 5 },
    scrollContent: { paddingHorizontal: 2, paddingTop: 3, paddingBottom: 40, gap: 8 },
    scrollEmpty: { flex: 1 },

    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
    emptyIconWrap: {
        width: 76, height: 76, borderRadius: 38, backgroundColor: "#fff",
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "#eceff2",
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
    emptyDesc: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },

    // Creator group card
    groupCard: {
        backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 1 },
            default: { boxShadow: "0 1px 4px rgba(0,0,0,0.06)" } as any,
        }),
    },
    creatorHeader: {
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 14, paddingVertical: 13,
    },
    creatorAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    creatorAvatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    creatorInfo: { flex: 1 },
    creatorName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
    creatorEmail: { fontSize: 11.5, color: "#9ca3af", marginTop: 1 },
    creatorRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    creatorPollCount: {
        fontSize: 12, fontWeight: "700", color: "#6b7280",
        backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    miniLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#1F9F4E" },

    pollsWrap: { paddingHorizontal: 8, paddingBottom: 8, gap: 6 },

    pollCard: {
        flexDirection: "row", borderRadius: 12, backgroundColor: "#fafbfc",
        borderWidth: 0.5, borderColor: "#eef0f2", overflow: "hidden",
    },
    statusRail: { width: 4 },
    railActive: { backgroundColor: "#1F9F4E" },
    railClosed: { backgroundColor: "#d1d5db" },

    pollInfo: { flex: 1, padding: 12, gap: 7 },
    pollTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    pollTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: "#545454ff", lineHeight: 19 },

    pollMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
    metaChipText: { fontSize: 12, color: "#6b7280" },

    pollFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pollDate: { fontSize: 12, color: "#b0b0b0" },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
    badgeActive: { backgroundColor: "#EAF6EE" },
    badgeClosed: { backgroundColor: "#f3f4f6" },
    badgeText: { fontSize: 12, fontWeight: "700" },
    badgeTextActive: { color: "#1F9F4E" },
    badgeTextClosed: { color: "#9ca3af" },
});