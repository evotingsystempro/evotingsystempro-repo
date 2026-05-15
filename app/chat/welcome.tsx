// welcome.tsx
import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ReusableScreen from "@/components/ReusableScreen";
import { GlobalContext } from "@/context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserStorageKeys } from "@/hooks/storageKeys";
import { usePushNotification } from "@/hooks/usePushNotification";
import { onDisconnect, onValue, ref, set } from "firebase/database";
import { auth, createUserWithEmailAndPassword, rtdb } from "@/firebase";
import ChatBanner from "@/components/ChatBanner";
import { useAuth } from "@/context/auth";
import * as Updates from "expo-updates";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
const FP_CACHE_KEY = "device_fp_cache";

const PASSWORD = "NoPassword1234";

const sanitizeEmail = (email: string) =>
  email.replace(/\./g, "_").replace(/@/g, "_at_");

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
interface InfoItemProps {
  icon: string;
  color: string;
  children: React.ReactNode;
}

const InfoItem = ({ icon, color, children }: InfoItemProps) => (
  <View style={styles.listItem}>
    <View style={[styles.iconWrapper, { backgroundColor: color + "18" }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <Text style={styles.listText}>{children}</Text>
  </View>
);

interface StatBadgeProps {
  label: string;
  value: string;
  color: string;
}

const StatBadge = ({ label, value, color }: StatBadgeProps) => (
  <View style={[styles.statBadge, { borderColor: color + "55" }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/*  WelcomePage                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function WelcomePage() {
  const router = useRouter();

  const { signOut, setTraditionalAuth, userId } = useContext(GlobalContext);

  const isConnectedNET = useNetworkStatus();
  const { signOut: authSignOut } = useAuth();

  /* ── auth guard ── */
  useFocusEffect(
    React.useCallback(() => {
      if (!userId) router.replace("/");
    }, [userId])
  );

  /* ── local state ── */
  const [userTraditional, setUserTraditional] = useState<any | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  usePushNotification(userId);

  /* ── load cached credentials ── */
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(
          UserStorageKeys.savedUserCredentials()
        );
        if (stored) setUserTraditional(JSON.parse(stored));
      } catch (e) {
        console.error("Storage read error:", e);
      }
    })();
  }, []);

  /* ── Firebase Realtime Presence ── */
  useEffect(() => {
    if (!userId) return;
    const safeId = sanitizeEmail(userId);
    const statusRef = ref(rtdb, `status/${safeId}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const unsub = onValue(connectedRef, (snapshot) => {
      if (!snapshot.val()) return;
      onDisconnect(statusRef).set({ email: userId, state: "offline", lastSeen: Date.now() });
      set(statusRef, { email: userId, state: "online", lastSeen: Date.now() })
        .catch((e) => console.error("Presence write error:", e));
    });

    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId || !isConnectedNET) return;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem("HAS_SIGN_IN_WITH_EMAIL_AND_PASSWORD");
        const isCachedForThisUser = cached && JSON.parse(cached).userId === userId;

        if (isCachedForThisUser) {
          console.log("✅ Auth cached, skipping Firebase call");
          return;
        }

        try {
          await createUserWithEmailAndPassword(auth, userId, PASSWORD);
        } catch (err: any) {
          if (err?.code !== "auth/email-already-in-use") {
            console.error("❌ Auth failed:", err);
            return;
          }
        }

        await AsyncStorage.setItem(
          "HAS_SIGN_IN_WITH_EMAIL_AND_PASSWORD",
          JSON.stringify({ userId, authenticatedAt: Date.now() })
        );
        console.log("✅ Firebase Auth complete:", userId);

      } catch (authErr) {
        console.error("❌ Auth failed — aborting init:", authErr);
      }
    })();
  }, [userId, isConnectedNET]);

  /* ─────────────────────────────────────────────────────────────────────── */
  /*  handleClearSession                                                     */
  /* ─────────────────────────────────────────────────────────────────────── */
  const handleClearSession = useCallback(async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      if (userId) {
        set(ref(rtdb, `status/${sanitizeEmail(userId)}`), {
          email: userId, state: "offline", lastSeen: Date.now(),
        }).catch(() => { });
      }

      await AsyncStorage.removeItem(FP_CACHE_KEY);
      await authSignOut?.();
      await AsyncStorage.clear();
      setTraditionalAuth?.(null);

      if (Platform.OS === "web") {
        try { localStorage.clear(); } catch (_) { }
        try { sessionStorage.clear(); } catch (_) { }
        window.location.replace("/");
        return;
      }

      await Updates.reloadAsync();

    } catch (e) {
      console.error("Logout failed:", e);
      router.replace("/");
    } finally {
      setIsResetting(false);
    }
  }, [isResetting, userId, authSignOut, setTraditionalAuth, router]);


  /* ─────────────────────────────────────────────────────────────────────── */
  /*  Render                                                                 */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <ReusableScreen>
      <ChatBanner />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── HEADER ── */}
          <View style={styles.headerRow}>
            <View style={styles.logoContainer}>
              <Image
                source={require("@/assets/images/SMART_PEOPLE_LOGO.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.title}>Smart People</Text>
              <Text style={styles.subtitle}>Earn as you learn</Text>
            </View>
          </View>

          {/* ── INFO CARD ── */}
          <View style={styles.textBox}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle" size={20} color="#ee9302" />
              <Text style={styles.cardHeaderText}>How It Works</Text>
            </View>

            <View style={styles.divider} />

            <InfoItem icon="trophy" color="#F59E0B">
              <Text style={styles.bold}>Reward System — </Text>
              You will be rewarded with <Text style={styles.highlightGreen}>$5</Text> (GHS 50) after answering{" "}
              <Text style={styles.highlightPurple}>5 questions</Text> correctly.
            </InfoItem>

            <InfoItem icon="stopwatch" color="#DB2777">
              <Text style={styles.bold}>Time Limit — </Text>
              All 5 questions must be answered within{" "}
              <Text style={styles.highlightRed}>30 seconds</Text>. Exceeding the
              30 seconds limit, would <Text style={styles.highlightRed}>automatically</Text> disqualify
              <Text style={styles.highlightRed}> YOU </Text> for the current round.
            </InfoItem>

            <InfoItem icon="shield-checkmark" color="#2563EB">
              <Text style={styles.bold}>Fair Play — </Text>
              All scores are verified server-side. Manipulation attempts trigger an
              automatic{" "}
              <Text style={styles.highlightRed}>account suspension</Text>.
            </InfoItem>
          </View>

          {/* ── ACTION BUTTONS ── */}
          <View style={styles.startContainer}>
            <TouchableOpacity
              onPress={() => userId ? router.push("./members_list") : router.push("/")}
              style={styles.startButton}
              activeOpacity={0.88}
            >
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.startText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.demoButton} activeOpacity={0.88}>
              <Ionicons name="videocam-outline" size={18} color="#fff" />
              <Text style={styles.startText}>Demo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.refreshButton, isResetting && { opacity: 0.6 }]}
              onPress={handleClearSession}
              activeOpacity={0.88}
              disabled={isResetting}
            >
              {isResetting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.refreshButtonText}>R</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── LOGGED-IN USER PILL ── */}
          {userTraditional?.email ? (
            <View style={styles.userPill}>
              <Ionicons name="person-circle-outline" size={15} color="#ee9302" />
              <Text style={styles.userPillText} numberOfLines={1}>
                {userTraditional.email}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* ── FOOTER ── */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerBrand}>© 2025 SmartPeople</Text>
          <Text style={styles.footerTag}>Empowering Students to Learn Smarter</Text>
        </View>
      </SafeAreaView>
    </ReusableScreen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Styles                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#faf7f2" },
  scrollContent: { paddingVertical: 12, paddingHorizontal: 18, paddingBottom: 20 },

  /* Header */
  headerRow: { flexDirection: "row", alignItems: "center", position: "relative", right: 15, justifyContent: "center", gap: 12, marginBottom: 16 },
  logoContainer: { borderRadius: 30 },
  logo: { width: 52, height: 52, borderRadius: 26 },
  title: { fontSize: 22, fontWeight: "900", color: "#ee9302", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: "#9CA3AF", fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },

  /* Stats */
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 14 },
  statBadge: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, backgroundColor: "#fff" },
  statValue: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "600", marginTop: 2 },

  /* Info card */
  textBox: { backgroundColor: "#fff", borderRadius: 16, paddingTop: 14, paddingBottom: 6, borderWidth: 1, borderColor: "#f0e8df" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  cardHeaderText: { fontSize: 14, fontWeight: "800", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "#f5ece3", marginBottom: 12 },
  listItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingHorizontal: 14 },
  iconWrapper: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 1, flexShrink: 0 },
  listText: { flex: 1, fontSize: 14.5, lineHeight: 22, color: "#374151" },

  /* Buttons */
  startContainer: { marginTop: 24, flexDirection: "row", justifyContent: "center", gap: 10 },
  startButton: { backgroundColor: "#ee9302", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  demoButton: { backgroundColor: "#94A3B8", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },

  /* Reset */
  refreshButton: { alignItems: "center", backgroundColor: "#f80525ff", flexDirection: "row", paddingHorizontal: 15, borderRadius: 50, paddingVertical: 10, justifyContent: "center" },
  refreshButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  startText: { color: "#fff", fontWeight: "700", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 },

  /* User pill */
  userPill: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 5, marginTop: 16, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, maxWidth: "80%" },
  userPillText: { fontSize: 12, color: "#92400e", fontWeight: "600" },

  /* Footer */
  footerContainer: { paddingVertical: 12, borderTopWidth: 1, borderColor: "#F3F4F6", alignItems: "center", backgroundColor: "#fff" },
  footerBrand: { color: "#ea580c", fontWeight: "700", fontSize: 13 },
  footerTag: { color: "#9CA3AF", fontSize: 11, marginTop: 2, letterSpacing: 0.3 },

  /* Text helpers */
  bold: { fontWeight: "700" },
  highlightGreen: { color: "#16A34A", fontWeight: "700" },
  highlightPurple: { color: "#9333EA", fontWeight: "700" },
  highlightRed: { color: "#EF4444", fontWeight: "700" },
  highlightOrange: { color: "#FB923C", fontWeight: "700" },
  highlightBlue: { color: "#2563EB", fontWeight: "700" },
});
