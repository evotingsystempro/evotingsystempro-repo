// screens/ScoreboardScreen.tsx
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    View,
    Text,
    FlatList,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Platform,
    ActivityIndicator,
} from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { GlobalContext } from "@/context";
import ReusableScreen from "@/components/ReusableScreen";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    startAfter,
    limit,
    getDoc,
    doc,
    addDoc,
    serverTimestamp,
    increment,
    setDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import { timeAgo } from "@/hooks/timeAgo";
import CheckUpdateModalComponent from "@/components/CheckUpdateModalComponent";
import { useScoreboard } from "@/hooks/ScoreboardScreenHooks/useScoreboard";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import PopupMenu from "@/components/PupupMenu";
import { UserStorageKeys } from "@/hooks/storageKeys";
import ChatBanner from "@/components/ChatBanner";
import { MenuProvider } from "react-native-popup-menu";

export default function ScoreboardScreen() {
    const {
        setShowUpdateButton,
        showUpdateButton,
        serverVersionLabel,
        setScoresCleared,
        userName,
        userId,
        setWrongCountTOT,
        userPhotoUrl,
    } = useContext(GlobalContext);

    useFocusEffect(
        useCallback(() => {
            if (!userName) router.replace("/");
        }, [userName])
    );

    const [refreshing, setRefreshing] = useState(false);
    const [dayCount, setDayCount] = useState<number>(1);
    const [initialNumToRender, setInitialNumToRender] = useState(20);
    const inputRef = useRef<TextInput>(null);
    const [inputHeight, setInputHeight] = useState(40);
    const [visibleReplies, setVisibleReplies] = useState<Record<string, boolean>>({});
    const [receiverSub, setReceiverSub] = useState("");
    const [receiverName, setReceiverName] = useState("");
    const [reply_comment_name, setReply_comment_name] = useState("");
    const [reply_comment_sub, setReply_comment_sub] = useState("");
    const [pendingComments, setPendingComments] = useState<Record<string, any>>({});
    const [currentComment, setCurrentComment] = useState("");
    const [selectedComment_id, setSelectedComment_id] = useState("");
    const lastVisibleRef2 = useRef<any>(null);
    const replyScrollRefs = useRef<Record<string, any>>({});
    const [loadingMore, setLoadingMore] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const isConnectedNET = useNetworkStatus();
    const [commentData, setCommentData] = useState<Record<string, any>>({});
    const [selectedReplySub, setSelectedReplySub] = useState<string | null>(null);


    const {
        scoreboardData,
        setScoreboardData,
        fetchNextPage,
        loading,
    } = useScoreboard();

    // ✅ FIX 1: useMemo now depends directly on `scoreboardData` (not on `data`
    // which was a new array reference every render, making the memo unstable).
    const sortedScoreboard = useMemo(() => {
        return Object.values(scoreboardData).sort(
            (a: any, b: any) => b.estimatedTotalScore - a.estimatedTotalScore
        );
    }, [scoreboardData]); // ✅ was: [data] — `data` was redeclared every render

    const uuId = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return Array.from({ length: 15 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join("");
    };

    const normalizeServerTime = (val: any): number => {
        if (!val) return Date.now();
        if (typeof val === "number") return val;
        if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
        if (val?.toMillis) return val.toMillis();
        if (val instanceof Date) return val.getTime();
        return Date.now();
    };

    useFocusEffect(
        useCallback(() => {
            const timeout = setTimeout(() => {
                setInitialNumToRender(100);
            }, 1000);
            return () => {
                clearTimeout(timeout);
            };
        }, [])
    );

    const uploadCommentToFirestore = async (comment: any) => {
        try {
            const colRef = collection(db, "SCOREBOARD_COMMENT_V5");
            await addDoc(colRef, {
                ...comment,
                clientId: comment.clientId,
                status: "sent",
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            console.error("Failed to upload comment:", err);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const cached = await AsyncStorage.getItem(
                    UserStorageKeys.commentDataCache(userId)
                );
                if (cached) {
                    setCommentData(JSON.parse(cached));
                }
                const queued = await AsyncStorage.getItem(
                    UserStorageKeys.pendingComments(userId)
                );
                if (queued) {
                    setPendingComments(JSON.parse(queued));
                }
            } catch (err) {
                console.error("Failed to load cached commentData:", err);
            }
        })();
    }, []);

    useEffect(() => {
        if (!isConnectedNET) return;

        const colRef = collection(db, "SCOREBOARD_COMMENT_V5");
        let unsubscribe: (() => void) | undefined;

        const startListener = async () => {
            try {
                const storedId = await AsyncStorage.getItem(
                    UserStorageKeys.lastVisibleCommentDocId(userId)
                );
                let q;
                if (storedId) {
                    const lastDocSnap = await getDoc(doc(colRef, storedId));
                    q = lastDocSnap.exists()
                        ? query(
                            colRef,
                            orderBy("createdAt", "asc"),
                            startAfter(lastDocSnap),
                            limit(100)
                        )
                        : query(colRef, orderBy("createdAt", "asc"), limit(100));
                } else {
                    q = query(colRef, orderBy("createdAt", "asc"), limit(100));
                }

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    if (snapshot.empty) return;

                    let lastDoc: any;
                    const incoming: Record<string, any> = {};

                    snapshot.forEach((docSnap) => {
                        const data: any = docSnap.data();
                        if (!data.sub || !data.receiverSub) return;
                        incoming[docSnap.id] = {
                            id: docSnap.id,
                            ...data,
                            status: "sent",
                            timestamp: normalizeServerTime(data.timestamp),
                            createdAt: normalizeServerTime(data.createdAt),
                        };
                        lastDoc = docSnap;
                    });

                    if (Object.keys(incoming).length > 0) {
                        setCommentData((prev: any) => {
                            const updated: Record<string, any> = { ...prev };
                            Object.values(incoming).forEach((serverComment: any) => {
                                const clientId = serverComment.clientId;
                                if (clientId && updated[clientId]) return;
                                if (clientId) {
                                    updated[clientId] = {
                                        ...serverComment,
                                        comment_read_status:
                                            prev[clientId]?.comment_read_status ?? "unread",
                                    };
                                    return;
                                }
                                updated[serverComment.id] = {
                                    ...serverComment,
                                    comment_read_status:
                                        prev[serverComment.id]?.comment_read_status ?? "unread",
                                };
                            });
                            AsyncStorage.setItem(
                                UserStorageKeys.commentDataCache(userId),
                                JSON.stringify(updated)
                            ).catch(console.error);
                            return updated;
                        });
                    }

                    if (lastDoc) {
                        lastVisibleRef2.current = lastDoc;
                        await AsyncStorage.setItem(
                            UserStorageKeys.lastVisibleCommentDocId(userId),
                            lastDoc.id
                        );
                    }
                });
            } catch (err) {
                console.error("Firestore comment listener error:", err);
            }
        };

        startListener();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isConnectedNET]);

    useEffect(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentDay = today.getDate();

        const checkAndUpdate = async () => {
            const saved = await AsyncStorage.getItem(
                UserStorageKeys.dayCounterData(userId)
            );
            if (saved) {
                const { month } = JSON.parse(saved);
                if (month === currentMonth) setDayCount(currentDay);
                else {
                    setDayCount(1);
                    await AsyncStorage.setItem(
                        UserStorageKeys.dayCounterData(userId),
                        JSON.stringify({ month: currentMonth, day: 1 })
                    );
                }
            } else {
                await AsyncStorage.setItem(
                    UserStorageKeys.dayCounterData(userId),
                    JSON.stringify({ month: currentMonth, day: currentDay })
                );
                setDayCount(currentDay);
            }
        };
        checkAndUpdate();
    }, []);

    const getOrdinal = (n: number): string => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    useEffect(() => {
        const syncPending = async () => {
            if (!isConnectedNET) return;
            try {
                const stored = await AsyncStorage.getItem(
                    UserStorageKeys.pendingComments(userId)
                );
                if (!stored) return;
                const pending = JSON.parse(stored);
                const entries = Object.values(pending);
                if (entries.length > 0) {
                    for (const comment of entries) {
                        await uploadCommentToFirestore(comment);
                    }
                    await AsyncStorage.removeItem(UserStorageKeys.pendingComments(userId));
                    setPendingComments({});
                }
            } catch (err) {
                console.error("Error syncing pending comments:", err);
            }
        };
        syncPending();
    }, [isConnectedNET]);

    const HandleComment = async () => {
        if (!currentComment.trim() && receiverSub.length > 0) return;
        setInputHeight(40);

        const sub = userId;
        const clientId = `${sub}_${uuId()}`;

        const localObj = {
            id: clientId,
            clientId,
            sub,
            receiverSub,
            reply_comment_name,
            reply_comment_sub,
            text: currentComment,
            user: userName || "Unknown",
            email: userId || "",
            userPhotoUrl: userPhotoUrl || "",
            status: isConnectedNET ? "sent" : "pending",
            comment_read_status: "unread",
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
        };

        setCommentData((prev: any) => {
            const updated = {
                ...prev,
                [clientId]: { ...localObj, comment_read_status: "read" },
            };
            AsyncStorage.setItem(
                UserStorageKeys.commentDataCache(userId),
                JSON.stringify(updated)
            );
            return updated;
        });

        setCurrentComment("");
        setTimeout(() => scrollToBottom(receiverSub), 50);

        if (!isConnectedNET) {
            setPendingComments((prev) => {
                const queued = { ...prev, [clientId]: localObj };
                AsyncStorage.setItem(
                    UserStorageKeys.pendingComments(userId),
                    JSON.stringify(queued)
                );
                return queued;
            });
        } else {
            /*  await uploadCommentToFirestore(localObj);
             const SERVER_URL =
                 "https://email-service-405496305969.us-central1.run.app";
             await fetch(`${SERVER_URL}/push_notification`, {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({
                     title: userName || "Guest",
                     body: localObj.text || "Text comment",
                     data: {
                         screen: "chat/scoreboard_season_1",
                         commentId: String(localObj.id),
                     },
                 }),
             }); */
        }
    };

    const scrollToBottom = (id: any) => {
        replyScrollRefs.current[id]?.scrollToEnd({ animated: true });
    };

    const viewRepliesHandle = async (itemSub: any) => {
        setTimeout(() => scrollToBottom(itemSub), 50);
        setVisibleReplies((prev) => ({ ...prev, [itemSub]: !prev[itemSub] }));
        setCommentData((prev: any) => {
            const updated: any = {};
            for (const key in prev) {
                const c = prev[key];
                updated[key] = {
                    ...c,
                    comment_read_status:
                        c.receiverSub === itemSub ? "read" : c.comment_read_status,
                };
            }
            AsyncStorage.setItem(
                UserStorageKeys.commentDataCache(userId),
                JSON.stringify(updated)
            );
            return updated;
        });
    };

    const pressToReplyHandle = (
        itemSub: any,
        receiverName: any,
        _reply_comment_name: any,
        _reply_comment_sub: any
    ) => {
        setReply_comment_name("");
        setReply_comment_sub("");
        setReceiverName(receiverName);
        setSelectedReplySub((prev) => (prev === itemSub ? null : itemSub));
        setSelectedComment_id("");
        setReceiverSub(itemSub);
    };

    // ✅ FIX 3: `reply_comment_sub` was read before being set (it referred to the
    // stale outer scope variable). Now we accept it as a parameter and set it.
    const pressToReplyCommentHandle = (
        parent_receiver_sub: any,
        parent_receiver_name: any,
        selectedCommentId: any,
        reply_name: any,
        reply_sub: any // ✅ was missing — was reading stale outer `reply_comment_sub`
    ) => {
        setReceiverName(parent_receiver_name);
        setReceiverSub(parent_receiver_sub);
        setReply_comment_name(reply_name);
        setReply_comment_sub(reply_sub); // ✅ now correctly set
        setSelectedComment_id((prev) =>
            prev === selectedCommentId ? "" : selectedCommentId
        );
        setSelectedReplySub(null);
    };

    const reactionLock = useRef(new Set<string>());

    const updateReaction = async (
        sub: string,
        field: "likes" | "dislikes" | "hearts"
    ) => {
        const lockKey = `${sub}_${field}`;
        const storageKey = `reaction_${sub}_${field}`;
        if (reactionLock.current.has(lockKey)) return;
        reactionLock.current.add(lockKey);
        try {
            const alreadyReacted = await AsyncStorage.getItem(storageKey);
            if (alreadyReacted) return;
            setScoreboardData((prev) => {
                const current = prev?.[sub] || {};
                return {
                    ...prev,
                    [sub]: {
                        ...current,
                        [field]: (current[field] || 0) + 1,
                        [`${field}Pressed`]: true,
                    },
                };
            });
            await AsyncStorage.setItem(storageKey, "true");
            await setDoc(
                doc(db, "SCOREBOARD_V5", sub),
                { [field]: increment(1) },
                { merge: true }
            );
        } catch (error) {
            console.error("Reaction update failed:", error);
        } finally {
            reactionLock.current.delete(lockKey);
        }
    };

    const handleClearSession = async () => {
        try {
            if (Platform.OS === "web") {
                window.location.replace("/");
            } else {
                router.replace("/");
            }
        } catch (error) {
            console.error("Failed to clear session:", error);
            alert("Unable to reset the session. Please try again.");
        }
    };

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshing(true);
            await handleClearSession();
        } catch (error) {
            console.error("Refresh failed:", error);
        } finally {
            setRefreshing(false);
        }
    }, []);


    useEffect(() => {
        const timer = setTimeout(() => setShowLoader(false), 150);
        return () => clearTimeout(timer);
    }, []);

    if (showLoader) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#eb06c8ff" />
            </View>
        );
    }

    const renderItem = ({ item, index }: any) => {
        const initials = item.user?.[0]?.toUpperCase() || "?";
        return (
            <View style={styles.cardWrapper}>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor:
                                selectedReplySub === item.sub ? "#f4fbefff" : "#ffffff",
                        },
                    ]}
                >
                    <View>
                        <View style={styles.userInfo}>
                            {item.userPhotoUrl ? (
                                <View>
                                    <Image
                                        source={require("@/assets/images/userImagePlaceHolder.jpeg")}
                                        style={{
                                            width: "50%",
                                            backgroundColor: "#f0f0f0",
                                            height: "50%",
                                            position: "absolute",
                                            top: 6,
                                            left: 10,
                                        }}
                                        resizeMode="cover"
                                    />
                                    <Image
                                        source={{ uri: item.userPhotoUrl }}
                                        style={styles.avatar}
                                    />
                                </View>
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: "#5c4033" }]}>
                                    <Text style={styles.avatarText}>{initials}</Text>
                                </View>
                            )}

                            <View
                                style={{
                                    position: "relative",
                                    bottom: 5,
                                    flex: 1,
                                    flexDirection: "column",
                                }}
                            >
                                <View
                                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                                >
                                    <Text
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={[styles.userName, { width: 100 }]}
                                    >
                                        {item.user}
                                    </Text>
                                    <Text style={styles.timeText}>
                                        {item?.createdAt &&
                                            !isNaN(new Date(item.createdAt).getTime())
                                            ? timeAgo(new Date(item.createdAt).getTime())
                                            : "Just now"}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.scoreBadge}>
                                <Text style={styles.scoreTag}>+ {item?.currentCorrectScore}</Text>
                            </View>
                        </View>

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 5,
                                marginBottom: 10,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 10,
                                    alignItems: "center",
                                    marginLeft: 10,
                                }}
                            >
                                <View>
                                    <Text style={styles.rankText}>{getOrdinal(index + 1)}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.scoreBox,
                                        {
                                            backgroundColor: "#deeeddff",
                                            flexDirection: "row",
                                            alignItems: "center",
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.scoreValue,
                                            {
                                                color: "#138b0cff",
                                                paddingVertical: 8,
                                                paddingHorizontal: 5,
                                                fontSize:
                                                    String(item.estimatedTotalScore).length === 1
                                                        ? 30
                                                        : String(item.estimatedTotalScore).length === 2
                                                            ? 28
                                                            : String(item.estimatedTotalScore).length === 3
                                                                ? 26
                                                                : String(item.estimatedTotalScore).length === 4
                                                                    ? 22
                                                                    : String(item.estimatedTotalScore).length === 5
                                                                        ? 20
                                                                        : String(item.estimatedTotalScore).length === 6
                                                                            ? 18
                                                                            : 16,
                                            },
                                        ]}
                                    >
                                        {item.estimatedTotalScore}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={{ color: "#666" }}>Points</Text>
                                </View>
                            </View>

                            <View
                                style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
                            >
                                <View style={{ flexDirection: "column", alignItems: "center" }}>
                                    <Text
                                        style={[
                                            styles.secondsUsedToPerformTask,
                                            {
                                                color:
                                                    item.totalScore === 0
                                                        ? "#ccc"
                                                        : item.totalScore > 30
                                                            ? "#f80808ff"
                                                            : "#1ab605ff",
                                            },
                                        ]}
                                    >
                                        {item.totalScore} secs
                                    </Text>

                                </View>
                                <View
                                    style={[
                                        styles.scoreBox,
                                        {
                                            borderWidth: 1,
                                            borderColor: "#fa0404ff",
                                            backgroundColor: "#fff",
                                        },
                                    ]}
                                >
                                    <Text style={[styles.scoreValue, { fontSize: 19, color: "red" }]}>
                                        {item.totalWrongScore}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Reactions row */}
                        <View style={styles.reactionsRow}>
                            <TouchableOpacity
                                onPress={() =>
                                    pressToReplyHandle(
                                        item.sub,
                                        item.user,
                                        reply_comment_name,
                                        reply_comment_sub
                                    )
                                }
                                style={[
                                    styles.reactButton,
                                    {
                                        borderWidth: 1,
                                        borderColor: "#c9e8b2ff",
                                        backgroundColor: "#fff",
                                        paddingVertical: 2,
                                        paddingHorizontal: 5,
                                        borderRadius: 5,
                                    },
                                ]}
                            >
                                <Text style={styles.reactText}>Reply</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => updateReaction(item.sub, "likes")}
                                style={styles.reactButton}
                            >
                                <AntDesign
                                    name="like1"
                                    size={18}
                                    color={item.likes > 0 ? "#30bb06ff" : "#9b9b9b"}
                                />
                                <Text style={styles.reactText}>{item.likes || 0}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => updateReaction(item.sub, "dislikes")}
                                style={styles.reactButton}
                            >
                                <AntDesign
                                    name="dislike1"
                                    size={18}
                                    color={item.dislikes > 0 ? "#d9534f" : "#9b9b9b"}
                                />
                                <Text style={styles.reactText}>{item.dislikes || 0}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => viewRepliesHandle(item.sub)}
                                style={styles.reactButton}
                            >
                                <Ionicons
                                    name={visibleReplies[item.sub] ? "chevron-down" : "chevron-up"}
                                    size={15}
                                    color="#888"
                                />
                                <Text style={styles.replyText}>Replies</Text>
                                <View>
                                    <Text
                                        style={[
                                            styles.replyCount,
                                            visibleReplies[item.sub]
                                                ? { backgroundColor: "#f1f1f1", color: "#000" }
                                                : (() => {
                                                    const hasUnread = Object.values(
                                                        commentData
                                                    ).some(
                                                        (c: any) =>
                                                            c.receiverSub === item.sub &&
                                                            c.comment_read_status === "unread"
                                                    );
                                                    return hasUnread
                                                        ? { backgroundColor: "#4caf50", color: "#fff" }
                                                        : { backgroundColor: "#f1f1f1", color: "#000" };
                                                })(),
                                        ]}
                                    >
                                        {
                                            Object.values(commentData).filter(
                                                (c: any) => c.receiverSub === item.sub
                                            ).length
                                        }
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {visibleReplies[item.sub] && (
                    <View style={{ flexDirection: "row", marginHorizontal: 20 }}>
                        <View style={styles.containerReact}>
                            <ScrollView
                                ref={(ref) => (replyScrollRefs.current[item.sub] = ref)}
                                nestedScrollEnabled={true}
                                contentContainerStyle={{ paddingTop: 2, flexGrow: 1 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {Object.values(commentData)
                                    .filter(
                                        (comment: any) => comment.receiverSub === item.sub
                                    )
                                    .map((comment: any, idx) => (
                                        <View key={idx} style={styles.messageContainer}>
                                            {comment.userPhotoUrl ? (
                                                <Image
                                                    source={{ uri: comment.userPhotoUrl }}
                                                    style={styles.replyAvatar}
                                                />
                                            ) : (
                                                <View
                                                    style={[
                                                        styles.replyAvatar,
                                                        { backgroundColor: "#5c4033" },
                                                    ]}
                                                >
                                                    <Text style={styles.avatarText}>
                                                        {comment.user?.[0]?.toUpperCase() || "?"}
                                                    </Text>
                                                </View>
                                            )}

                                            <View
                                                style={[
                                                    styles.messageBox,
                                                    {
                                                        backgroundColor:
                                                            comment.id === selectedComment_id
                                                                ? "#d1e7ff"
                                                                : "#f0f0f0",
                                                    },
                                                ]}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: "row",
                                                        alignItems: "baseline",
                                                        gap: 6,
                                                    }}
                                                >
                                                    <Text
                                                        numberOfLines={1}
                                                        ellipsizeMode="tail"
                                                        style={[styles.name, { maxWidth: 100 }]}
                                                    >
                                                        {comment.user}
                                                    </Text>
                                                    <Text
                                                        numberOfLines={1}
                                                        ellipsizeMode="head"
                                                        style={[styles.email, { maxWidth: 140 }]}
                                                    >
                                                        {comment.reply_comment_name
                                                            ? "Replying: " + comment.reply_comment_name
                                                            : ""}
                                                    </Text>
                                                </View>

                                                <View style={{ marginRight: 15 }}>
                                                    <Text style={styles.message}>
                                                        {comment.text}{" "}
                                                        <Text style={styles.time}>
                                                            {comment.createdAt
                                                                ? timeAgo(new Date(comment.createdAt).getTime())
                                                                : ""}
                                                        </Text>
                                                    </Text>
                                                </View>

                                                {/* ✅ FIX 3 applied here — pass comment.sub as reply_sub */}
                                                <TouchableOpacity
                                                    onPress={() =>
                                                        pressToReplyCommentHandle(
                                                            item.sub,
                                                            item.user,
                                                            comment.id,
                                                            comment.user,
                                                            comment.sub // ✅ pass the commenter's sub
                                                        )
                                                    }
                                                    style={styles.reply_replies_container}
                                                >
                                                    <Text style={styles.reply_replies}>Reply</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                            </ScrollView>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const HeaderScoreboard = () => (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TouchableOpacity
                        onPress={() =>
                            router.navigate({ pathname: "/chat/members_list" })
                        }
                    >
                        <Ionicons name="arrow-back" size={20} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.title}>All polls</Text>
                </View>
                <Text style={styles.subtitle}>
                    scoreboard •{" "}
                    <Text
                        style={{
                            color: isConnectedNET ? "#059b14ff" : "#ef4444ff",
                            fontSize: 13,
                        }}
                    >
                        {isConnectedNET ? "Online" : "Offline"}
                    </Text>
                </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.scorePips}>
                    <View style={styles.pip2}>
                        <Text style={styles.pipLabel}>Day</Text>
                        <Text style={styles.pipValue}>{dayCount}</Text>
                    </View>
                    <View style={[styles.pip, { backgroundColor: "orange" }]}>
                        <Text style={[styles.pipLabel, { color: "white" }]}>Reward</Text>
                        <Text style={[styles.pipValue, { color: "white" }]}>$100</Text>
                    </View>
                </View>
                <PopupMenu />
            </View>
        </View>
    );

    const isWeb = Platform.OS === "web";

    return (
        <ReusableScreen>
            <MenuProvider>
                <ChatBanner />
                <View style={{ flex: 1 }}>
                    <CheckUpdateModalComponent
                        visible={showUpdateButton}
                        title="Update Available"
                        message={`SmartLearnersApp APK Version: ${serverVersionLabel}\nis available. Download now?`}
                        confirmText="Download"
                        cancelText="Cancel"
                        confirmColor="#4CAF50"
                        cancelColor="#888"
                        onCancel={() => setShowUpdateButton(true)}
                    />
                    <View style={styles.container}>
                        <HeaderScoreboard />
                        <FlatList
                            data={sortedScoreboard}
                            keyExtractor={(item) => item.sub}
                            renderItem={renderItem}
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            // ✅ FIX 4: onEndReached now active on both platforms.
                            // Previously: mobile used `onScroll: loadMore` (wrong event shape,
                            // calling a pagination fn that only bumped a visibleCount slice —
                            // not the Firestore fetch). Web had it correct but commented out
                            // the real fetchNextPage. Now both call fetchNextPage correctly.
                            onEndReached={() => fetchNextPage()}
                            onEndReachedThreshold={isWeb ? 0.5 : 0.3}
                            initialNumToRender={initialNumToRender}
                            maxToRenderPerBatch={10}
                            windowSize={20}
                            removeClippedSubviews={false}
                            scrollEventThrottle={16}
                            ListFooterComponent={
                                loadingMore ? (
                                    <ActivityIndicator
                                        style={{ paddingVertical: 10 }}
                                        size="large"
                                        color="#fd7506ff"
                                    />
                                ) : null
                            }
                            contentContainerStyle={{ paddingBottom: 5 }}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <TextInput
                            ref={inputRef}
                            style={[styles.input, { height: Math.max(40, inputHeight) }]}
                            placeholder={
                                reply_comment_name?.length > 0
                                    ? reply_comment_name
                                    : receiverSub?.length > 0
                                        ? "Replying to..." + receiverName
                                        : "Select a user to reply.."
                            }
                            value={currentComment}
                            onChangeText={setCurrentComment}
                            maxLength={500}
                            multiline
                            onContentSizeChange={(e) =>
                                setInputHeight(e.nativeEvent.contentSize.height)
                            }
                        />
                        <TouchableOpacity
                            style={styles.sendBtn}
                            onPress={() => HandleComment()}
                        >
                            <Ionicons name="send" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </MenuProvider>
        </ReusableScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#ecececff", margin: 8 },
    header: {
        paddingLeft: 16,
        paddingTop: 3,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        marginBottom: 8,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
    },
    backButtonText: { fontSize: 14, fontWeight: "600", color: "#000" },
    headerLeft: { flexDirection: "column" },
    title: { color: "#0F172A", fontSize: 18, fontWeight: "700" },
    subtitle: { color: "#6B7280", fontSize: 13, marginTop: 2 },
    scorePips: { flexDirection: "row", alignItems: "center", gap: 3 },
    pip: {
        backgroundColor: "#ebe7e7ff",
        paddingHorizontal: 3,
        paddingVertical: 6,
        borderRadius: 10,
        alignItems: "center",
        minWidth: 64,
    },
    pip2: {
        backgroundColor: "#ebe7e7ff",
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        alignItems: "center",
    },
    pipLabel: { color: "#6B7280", fontSize: 12 },
    pipValue: { color: "#0F172A", fontSize: 15, fontWeight: "700" },
    cardWrapper: { flexDirection: "column" },
    card: {
        borderRadius: 15,
        marginHorizontal: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: "#ddd",
        marginBottom: 5,
    },
    rankText: { fontSize: 18, fontWeight: "300", color: "#777" },
    userInfo: { flexDirection: "row", alignItems: "center" },
    avatar: {
        width: 45,
        height: 45,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    replyAvatar: {
        width: 30,
        height: 30,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 2,
    },
    avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
    userName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
    timeText: { fontSize: 12, color: "#888" },
    pendingUpload: { fontSize: 14, color: "#888" },
    scoreBadge: {
        backgroundColor: "#fafa03ff",
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    scoreTag: { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
    scoreBox: {
        alignSelf: "center",
        backgroundColor: "#bbc1cdff",
        borderRadius: 10,
        paddingHorizontal: 5,
    },
    scoreValue: { fontSize: 16, fontWeight: "800", color: "#fff" },
    secondsUsedToPerformTask: { fontSize: 14, fontWeight: "600", color: "#ccc" },
    reactionsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginHorizontal: 10,
    },
    reactButton: { flexDirection: "row", alignItems: "center", gap: 4 },
    reactText: { fontSize: 13, color: "#444" },
    replyText: { fontSize: 13, color: "#444" },
    replyCount: {
        fontSize: 13,
        paddingHorizontal: 5,
        paddingVertical: 3,
        borderRadius: 50,
        alignItems: "center",
        justifyContent: "center",
    },
    containerReact: {
        flex: 1,
        maxHeight: 200,
        backgroundColor: "transparent",
        overflow: "hidden",
    },
    messageContainer: {
        flexDirection: "row",
        marginBottom: 5,
        alignItems: "flex-start",
    },
    messageBox: {
        borderRadius: 10,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: "#fff",
        padding: 10,
        maxWidth: 300,
    },
    name: { fontWeight: "700", color: "#000", fontSize: 14 },
    email: { color: "#888", fontSize: 14, marginBottom: 4 },
    message: { fontSize: 15, color: "#000", lineHeight: 20 },
    reply_replies_container: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    likeCount: { color: "#555", fontSize: 12, marginRight: 6 },
    time: { color: "#999", fontSize: 12, marginRight: 10 },
    reply_replies: { color: "#2076efff", fontSize: 13, marginRight: 6 },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "#fff",
    },
    input: {
        flex: 1,
        backgroundColor: "#f0f0f0",
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        marginHorizontal: 6,
        maxHeight: 100,
        ...(Platform.OS === "web" && {
            outlineStyle: "none",
            outlineWidth: 0,
            boxShadow: "none",
        }),
    },
    sendBtn: {
        backgroundColor: "#eb8125ff",
        padding: 12,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
});
