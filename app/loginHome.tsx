import React, { useCallback, useContext, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { GlobalContext } from "@/context";
import ReusableScreen from "@/components/ReusableScreen";

const { width: SW, height: SH } = Dimensions.get("window");

/* ─────────────────────────────────────────────────────────
   Design Tokens
───────────────────────────────────────────────────────── */
const T = {
  bg: "#FDE8C5",
  brand: "#F07316",
  brandDeep: "#C45A0A",
  brandLight: "#FEE9D3",
  brandBorder: "#FAD4A8",
  brandMuted: "#F9A96A",
  ink: "#1C1208",
  inkSoft: "#6B5640",
  inkMuted: "#A8937C",
  inkInverse: "#FFFFFF",
  border: "#EDE4D8",
  divider: "#F0E8DD",
};

/* ─────────────────────────────────────────────────────────
   Background
───────────────────────────────────────────────────────── */
function GrainOverlay() {
  const dots = useMemo(() => {
    let seed = 77;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };
    return Array.from({ length: 55 }, (_, i) => ({
      key: i,
      top: rand() * 100,
      left: rand() * 100,
      size: 1 + rand() * 1.5,
      opacity: 0.035 + rand() * 0.055,
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {dots.map((d) => (
        <View key={d.key} style={{
          position: "relative",
          top: `${d.top}%` as any,
          left: `${d.left}%` as any,
          width: d.size, height: d.size,
          borderRadius: d.size / 2,
          backgroundColor: "#7A3A00",
          opacity: d.opacity,
        }} />
      ))}
    </View>
  );
}

function Background() {
  const blobs = [
    { x: 12, y: 16, size: 120, color: "rgba(249,169,106,0.52)" },
    { x: SW - 115, y: 30, size: 105, color: "rgba(240,115,22,0.26)" },
    { x: 18, y: SH * 0.28, size: 54, color: "rgba(240,115,22,0.36)" },
    { x: SW - 62, y: SH * 0.38, size: 42, color: "rgba(253,188,120,0.45)" },
    { x: 28, y: SH * 0.56, size: 26, color: "rgba(240,115,22,0.22)" },
    { x: SW - 148, y: SH - 195, size: 138, color: "rgba(249,169,106,0.45)" },
    { x: 14, y: SH - 155, size: 85, color: "rgba(240,115,22,0.20)" },
    { x: SW / 2 - 16, y: SH - 75, size: 30, color: "rgba(253,188,120,0.38)" },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.bg }]} />
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: SH * 0.32, backgroundColor: "#FFCF95", opacity: 0.3,
        borderTopLeftRadius: 220, borderTopRightRadius: 220,
      }} />
      {blobs.map((b, i) => (
        <View key={i} style={{
          position: "absolute",
          left: b.x, top: b.y,
          width: b.size, height: b.size,
          borderRadius: b.size / 2,
          backgroundColor: b.color,
        }} />
      ))}
      <GrainOverlay />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   Screen
═══════════════════════════════════════════════════════ */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading, userId } = useContext(GlobalContext);

  useFocusEffect(
    useCallback(() => {
      if (userId) router.replace("/");
    }, [userId])
  );

  const handleGoogleSignIn = async () => {
    try { await signIn(); }
    catch (err: any) { console.error("Google sign-in failed:", err.message); }
  };

  if (isLoading) {
    return (
      <View style={S.loaderWrap}>
        <Background />
        <View style={S.loaderCard}>
          <ActivityIndicator size="small" color={T.brand} />
          <Text style={S.loaderText}>Signing you in…</Text>
        </View>
      </View>
    );
  }

  return (
    <ReusableScreen>
      <Background />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} bounces={false}>

          <View style={{ flex: 1, justifyContent: "center" }}>

            {/* ── Hero ── */}
            <View style={S.hero}>
              <View style={S.logoGlowOuter}>
                <View style={S.logoGlowInner}>
                  <Image source={require("@/assets/images/SMART_PEOPLE_LOGO.png")} style={S.logo} resizeMode="contain" />
                </View>
              </View>
              <Text style={S.appName}>Smart People</Text>
              <Text style={S.appTagline}>Earn as you learn</Text>
              <View style={S.heroDivider}>
                <View style={S.heroDividerLine} />
                <View style={S.heroDividerDot} />
                <View style={S.heroDividerLine} />
              </View>
            </View>

            {/* ── Auth Card ── */}
            <View style={S.authCard}>
              <TouchableOpacity onPress={handleGoogleSignIn} style={S.socialButton}>
                <Image source={require("@/assets/images/google-icon.png")} style={S.logoGoogle} />
                <Text style={S.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={S.orDivider}>
                <View style={S.orLine} />
                <Text style={S.orLabel}>or use your email</Text>
                <View style={S.orLine} />
              </View>

              <TouchableOpacity style={S.loginBtn} onPress={() => router.navigate("./login")} activeOpacity={0.82}>
                <Text style={S.loginBtnText}>Log In</Text>
              </TouchableOpacity>

              <TouchableOpacity style={S.registerBtn} onPress={() => router.navigate("./register")} activeOpacity={0.82}>
                <Text style={S.registerBtnText}>Create an Account</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* ── Footer ── */}
          <View style={S.footer}>
            <Text style={S.footerCopy}>© 2025 SmartPeople</Text>
            <TouchableOpacity onPress={() => router.push("./PrivacyPolicy&TermsOfUse")}>
              <Text style={S.footerLink}>Terms & Conditions · Privacy Policy</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ReusableScreen>
  );
}

/* ═══════════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 16,
    borderWidth: 1, borderColor: T.border,
  },
  loaderText: { fontSize: 14, fontWeight: "600", color: T.inkSoft },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    justifyContent: "center",
  },

  /* Hero */
  hero: { alignItems: "center", marginBottom: 32 },
  logoGlowOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(240,115,22,0.16)",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  logoGlowInner: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(240,115,22,0.22)",
  },
  logo: { width: 62, height: 62 },
  appName: { fontSize: 28, fontWeight: "800", color: T.brand, letterSpacing: -0.6, marginBottom: 4 },
  appTagline: { fontSize: 17, fontWeight: "500", color: "red", marginBottom: 20, textAlign: "center" },
  heroDivider: { flexDirection: "row", alignItems: "center", gap: 8, width: 120 },
  heroDividerLine: { flex: 1, height: 1, backgroundColor: T.brandBorder, borderRadius: 1 },
  heroDividerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.brandMuted },

  /* Auth Card */
  authCard: {
    gap: 12, marginBottom: 32,
    width: "100%", alignSelf: "center",
    backgroundColor: "rgba(255,252,248,0.78)",
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 24,
    borderWidth: 1, borderColor: "rgba(255,215,160,0.55)",
  },

  socialButton: {
    borderRadius: 50, paddingHorizontal: 20, paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.92)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#F9E0C2",
    flexDirection: "row", gap: 8,
  },
  socialBtnText: { fontSize: 15, color: T.ink, fontWeight: "700" },
  logoGoogle: { width: 22, height: 22 },

  orDivider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  orLine: { flex: 1, height: 1, backgroundColor: T.divider, borderRadius: 1 },
  orLabel: { fontSize: 12, fontWeight: "600", color: T.inkMuted, letterSpacing: 0.2 },

  loginBtn: {
    backgroundColor: T.brand, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
  },
  loginBtnText: { fontSize: 16, fontWeight: "700", color: T.inkInverse, letterSpacing: -0.1 },

  registerBtn: {
    backgroundColor: T.brandLight, borderRadius: 14,
    borderWidth: 1.5, borderColor: T.brandBorder,
    paddingVertical: 15, alignItems: "center", justifyContent: "center",
  },
  registerBtnText: { fontSize: 16, fontWeight: "700", color: T.brandDeep, letterSpacing: -0.1 },

  footer: { alignItems: "center", gap: 8 },
  footerCopy: { fontSize: 15, color: "#000", fontWeight: "500" },
  footerLink: { fontSize: 15, fontWeight: "800", color: T.brand },
});
