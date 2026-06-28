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
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import ReusableScreen from "@/components/ReusableScreen";
import { db } from "@/firebase";
import { collectionGroup, getDocs } from "firebase/firestore";

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

const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PollsListScreen() {
    const [groups, setGroups] = useState<CreatorGroup[]>([]);
    const [filtered, setFiltered] = useState<CreatorGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "active" | "closed">("all");

    // ── Fetch ALL poll docs via a collectionGroup query on "polls" ─────────────
    // This works even if the parent CREATOR_EMAIL doc under POLL_TITLE_DB was
    // never explicitly created (which is the case here — CreatePollScreen only
    // ever writes to the "polls" subcollection, never to the parent doc itself).

    const fetchPolls = useCallback(async () => {
        try {
            const pollsSnap = await getDocs(collectionGroup(db, "polls"));

            const byCreator = new Map<string, PollSummary[]>();
            const creatorNames = new Map<string, string>();

            pollsSnap.docs.forEach((pd) => {
                const d = pd.data();
                // Each "polls" doc's parent path is POLL_TITLE_DB/{creatorEmail}/polls
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
                    showResults: d.showResults ?? true,
                    isAnonymous: d.isAnonymous ?? false,
                };

                if (!byCreator.has(creatorEmail)) byCreator.set(creatorEmail, []);
                byCreator.get(creatorEmail)!.push(summary);
                creatorNames.set(creatorEmail, creatorName);
            });

            const groupList: CreatorGroup[] = Array.from(byCreator.entries()).map(
                ([creatorEmail, polls]) => {
                    polls.sort((a, b) => {
                        if (!a.dateCreated || !b.dateCreated) return 0;
                        return (
                            new Date(b.dateCreated).getTime() -
                            new Date(a.dateCreated).getTime()
                        );
                    });
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

    const totalPolls = filtered.reduce((s, g) => s + g.polls.length, 0);
    const livePolls = filtered.reduce(
        (s, g) => s + g.polls.filter((p) => !isPollClosed(p)).length,
        0
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
                    <View style={{ width: 32 }} />
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#1F9F4E" />
                    <Text style={styles.loadingText}>Loading polls…</Text>
                </View>
            </ReusableScreen>
        );
    }

    return (
        <ReusableScreen>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={18} color="#1F9F4E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Polls</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color="#9ca3af" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search polls or creators…"
                    placeholderTextColor="#b0b0b0"
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                    {...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {})}
                />
                {search.length > 0 && Platform.OS !== "ios" && (
                    <TouchableOpacity
                        onPress={() => setSearch("")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close-circle" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.filterRow}>
                {(["all", "active", "closed"] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterTab, filter === f && styles.filterTabActive]}
                        onPress={() => setFilter(f)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
                <View style={{ flex: 1 }} />
                <Text style={styles.countLabel}>
                    {totalPolls} poll{totalPolls !== 1 ? "s" : ""}
                    {livePolls > 0 && filter === "all" ? ` · ${livePolls} live` : ""}
                </Text>
            </View>

            <View style={styles.divider} />

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
                        <MaterialIcons name="ballot" size={48} color="#d1d5db" />
                        <Text style={styles.emptyTitle}>No polls found</Text>
                        <Text style={styles.emptyDesc}>
                            {search ? "Try a different search term." : "No polls have been created yet."}
                        </Text>
                    </View>
                ) : (
                    filtered.map((group, gi) => (
                        <View key={group.creatorEmail}>
                            <View style={styles.creatorHeader}>
                                <View style={styles.creatorAvatar}>
                                    <Text style={styles.creatorAvatarText}>
                                        {group.creatorName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.creatorInfo}>
                                    <Text style={styles.creatorName}>{group.creatorName}</Text>
                                    <Text style={styles.creatorEmail}>{group.creatorEmail}</Text>
                                </View>
                                <Text style={styles.creatorPollCount}>
                                    {group.polls.length} poll{group.polls.length !== 1 ? "s" : ""}
                                </Text>
                            </View>

                            {group.polls.map((poll, pi) => {
                                const closed = isPollClosed(poll);
                                const expired = isExpired(poll.deadline);
                                return (
                                    <View key={poll.pollId}>
                                        <TouchableOpacity
                                            style={styles.pollRow}
                                            onPress={() => openPoll(poll)}
                                            activeOpacity={0.65}
                                        >
                                            <View style={[
                                                styles.statusDot,
                                                closed ? styles.dotClosed : styles.dotActive,
                                            ]} />

                                            <View style={styles.pollInfo}>
                                                <Text style={styles.pollTitle} numberOfLines={2}>
                                                    {poll.title}
                                                </Text>
                                                <View style={styles.pollMeta}>
                                                    <View style={styles.metaChip}>
                                                        <Ionicons name="people-outline" size={11} color="#6b7280" />
                                                        <Text style={styles.metaChipText}>
                                                            {poll.aspirantCount} aspirant{poll.aspirantCount !== 1 ? "s" : ""}
                                                        </Text>
                                                    </View>
                                                    {poll.pollType === "multiple" && (
                                                        <View style={styles.metaChip}>
                                                            <Ionicons name="layers-outline" size={11} color="#6b7280" />
                                                            <Text style={styles.metaChipText}>Multi-vote</Text>
                                                        </View>
                                                    )}
                                                    {poll.isAnonymous && (
                                                        <View style={styles.metaChip}>
                                                            <Ionicons name="eye-off-outline" size={11} color="#6b7280" />
                                                            <Text style={styles.metaChipText}>Anonymous</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {poll.dateCreated ? (
                                                    <Text style={styles.pollDate}>{formatDate(poll.dateCreated)}</Text>
                                                ) : null}
                                            </View>

                                            <View style={styles.pollRight}>
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
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={15}
                                                    color="#d1d5db"
                                                    style={{ marginTop: 6 }}
                                                />
                                            </View>
                                        </TouchableOpacity>

                                        {pi < group.polls.length - 1 && (
                                            <View style={styles.rowDivider} />
                                        )}
                                    </View>
                                );
                            })}

                            {gi < filtered.length - 1 && <View style={styles.groupDivider} />}
                        </View>
                    ))
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
    headerTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", letterSpacing: -0.2 },

    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: "#e5e7eb",
    },
    searchInput: { flex: 1, fontSize: 14, color: "#1a1a1a", paddingVertical: Platform.OS === "ios" ? 0 : 2 },

    filterRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10 },
    filterTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "#f3f4f6" },
    filterTabActive: { backgroundColor: "#EAF6EE" },
    filterTabText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
    filterTabTextActive: { color: "#1F9F4E", fontWeight: "700" },
    countLabel: { fontSize: 12, color: "#9ca3af" },

    divider: { height: 0.5, backgroundColor: "#e5e7eb" },
    rowDivider: { height: 0.5, backgroundColor: "#f3f4f6", marginLeft: 44 },
    groupDivider: { height: 8, backgroundColor: "#f3f4f6" },

    scroll: { flex: 1, backgroundColor: "#f9fafb" },
    scrollContent: { paddingBottom: 40 },
    scrollEmpty: { flex: 1 },

    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
    emptyDesc: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingHorizontal: 32 },

    creatorHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        backgroundColor: "#f9fafb",
    },
    creatorAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1F9F4E", alignItems: "center", justifyContent: "center" },
    creatorAvatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    creatorInfo: { flex: 1 },
    creatorName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
    creatorEmail: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
    creatorPollCount: { fontSize: 12, color: "#9ca3af" },

    pollRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff" },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2, flexShrink: 0 },
    dotActive: { backgroundColor: "#1F9F4E" },
    dotClosed: { backgroundColor: "#d1d5db" },

    pollInfo: { flex: 1, gap: 5 },
    pollTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", lineHeight: 20 },
    pollMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
    metaChipText: { fontSize: 11, color: "#6b7280" },
    pollDate: { fontSize: 11, color: "#b0b0b0" },

    pollRight: { alignItems: "flex-end", gap: 2, flexShrink: 0 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    badgeActive: { backgroundColor: "#EAF6EE" },
    badgeClosed: { backgroundColor: "#f3f4f6" },
    badgeText: { fontSize: 11, fontWeight: "600" },
    badgeTextActive: { color: "#1F9F4E" },
    badgeTextClosed: { color: "#9ca3af" },
});