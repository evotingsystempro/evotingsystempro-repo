//loginHome.tsx
import React, { useCallback, useContext, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Image,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { GlobalContext } from "@/context";
import ReusableScreen from "@/components/ReusableScreen";
import { Ionicons } from "@expo/vector-icons";

const { width: SW, height: SH } = Dimensions.get("window");

const T = {
  bg: "#E8F5EE",
  brand: "#16A34A",
  brandDeep: "#0D6B32",
  brandLight: "#D1FAE5",
  brandBorder: "#A7F3D0",
  brandMuted: "#4ADE80",
  ink: "#052E16",
  inkSoft: "#166534",
  inkMuted: "#4B7C5E",
  inkInverse: "#FFFFFF",
  border: "#BBF7D0",
  divider: "#D1FAE5",
};

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
          backgroundColor: "#064E24",
          opacity: d.opacity,
        }} />
      ))}
    </View>
  );
}

function Background() {
  const blobs = [
    { x: 12, y: 16, size: 120, color: "rgba(74,222,128,0.35)" },
    { x: SW - 115, y: 30, size: 105, color: "rgba(22,163,74,0.20)" },
    { x: 18, y: SH * 0.28, size: 54, color: "rgba(22,163,74,0.28)" },
    { x: SW - 62, y: SH * 0.38, size: 42, color: "rgba(134,239,172,0.40)" },
    { x: 28, y: SH * 0.56, size: 26, color: "rgba(22,163,74,0.18)" },
    { x: SW - 148, y: SH - 195, size: 138, color: "rgba(74,222,128,0.30)" },
    { x: 14, y: SH - 155, size: 85, color: "rgba(22,163,74,0.16)" },
    { x: SW / 2 - 16, y: SH - 75, size: 30, color: "rgba(134,239,172,0.32)" },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: T.bg }]} />
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: SH * 0.32, backgroundColor: "#86EFAC", opacity: 0.25,
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={S.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ flex: 1, justifyContent: "center" }}>

            {/* ── Hero ── */}
            <View style={S.hero}>
              <View style={S.logoGlowOuter}>
                <View style={S.logoGlowInner}>
                  <Image
                    source={require("@/assets/images/LOGO.png")}
                    style={S.logo}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <Text style={S.appName}>Precision Voting App</Text>
              <View style={S.heroDivider}>
                <View style={S.heroDividerLine} />
                <View style={S.heroDividerDot} />
                <View style={S.heroDividerLine} />
              </View>
            </View>

            {/* ── Auth Card ── */}
            <View style={S.authCard}>

              {/* ── Top label ── */}
              <View style={S.labelRow}>
                <View style={S.labelLine} />
                <View style={S.labelBadge}>
                  <Ionicons name="lock-closed" size={11} color={T.brand} />
                  <Text style={S.labelText}>Secure Sign-In</Text>
                </View>
                <View style={S.labelLine} />
              </View>

              {/* ── Google Button ── */}
              <View style={S.btnWrapper}>
                {/* Decorative outer ring */}
                <View style={S.btnRingOuter}>
                  <View style={S.btnRingInner}>
                    <TouchableOpacity
                      onPress={handleGoogleSignIn}
                      style={S.socialButton}
                      activeOpacity={0.82}
                    >
                      <View style={S.googleIconWrap}>
                        <Image
                          source={require("@/assets/images/google-icon.png")}
                          style={S.logoGoogle}
                        />
                      </View>
                      <View style={S.btnTextBlock}>
                        <Text style={S.socialBtnText}>Continue with Google</Text>
                        <Text style={S.socialBtnSub}>Fast · Safe · One tap</Text>
                      </View>
                      <Ionicons name="arrow-forward-circle" size={22} color={T.brand} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* ── Trust badges ── */}
              <View style={S.trustRow}>
                <View style={S.trustBadge}>
                  <Ionicons name="shield-checkmark" size={13} color={T.brand} />
                  <Text style={S.trustText}>No password</Text>
                </View>
                <View style={S.trustDot} />
                <View style={S.trustBadge}>
                  <Ionicons name="flash" size={13} color={T.brand} />
                  <Text style={S.trustText}>Instant access</Text>
                </View>
                <View style={S.trustDot} />
                <View style={S.trustBadge}>
                  <Ionicons name="person-circle" size={13} color={T.brand} />
                  <Text style={S.trustText}>Your account</Text>
                </View>
              </View>

            </View>

          </View>

          {/* ── Footer ── */}
          <View style={S.footer}>
            <Text style={S.footerCopy}>© 2026 Precision Voting App</Text>
            <TouchableOpacity onPress={() => router.push("./PrivacyPolicy&TermsOfUse")}>
              <Text style={S.footerLink}>Terms & Conditions · Privacy Policy</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ReusableScreen>
  );
}

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

  /* ── Hero ── */
  hero: { alignItems: "center", marginBottom: 32 },
  logoGlowOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(22,163,74,0.16)",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  logoGlowInner: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(22,163,74,0.25)",
  },
  logo: { width: 62, height: 62 },
  appName: { fontSize: 25, fontWeight: "800", color: T.brand, letterSpacing: -0.6, marginBottom: 4 },
  appTagline: { fontSize: 22, fontWeight: "500", color: T.brandDeep, marginBottom: 20, textAlign: "center" },
  heroDivider: { flexDirection: "row", alignItems: "center", gap: 8, width: 120 },
  heroDividerLine: { flex: 1, height: 1, backgroundColor: T.brandBorder, borderRadius: 1 },
  heroDividerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.brandMuted },

  /* ── Auth Card ── */
  authCard: {
    marginBottom: 32,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(167,243,208,0.70)",
    gap: 20,
  },

  /* ── Secure label ── */
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  labelLine: { flex: 1, height: 1, backgroundColor: T.divider },
  labelBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.brandLight,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: T.brandBorder,
  },
  labelText: { fontSize: 11, fontWeight: "700", color: T.brand, letterSpacing: 0.3 },

  /* ── Button wrapper rings ── */
  btnWrapper: { alignItems: "center" },
  btnRingOuter: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(167,243,208,0.50)",
    padding: 5,
    backgroundColor: "rgba(220,252,231,0.40)",
  },
  btnRingInner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167,243,208,0.80)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)",
  },

  /* ── Google button ── */
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  googleIconWrap: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logoGoogle: { width: 22, height: 22 },
  btnTextBlock: { flex: 1 },
  socialBtnText: { fontSize: 15, color: T.ink, fontWeight: "700" },
  socialBtnSub: { fontSize: 11, color: T.inkMuted, marginTop: 1 },

  /* ── Trust badges ── */
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  trustText: { fontSize: 11, color: T.inkMuted, fontWeight: "500" },
  trustDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: T.brandBorder,
  },

  /* ── Footer ── */
  footer: { alignItems: "center", gap: 8 },
  footerCopy: { fontSize: 15, color: T.inkSoft, fontWeight: "500" },
  footerLink: { fontSize: 15, fontWeight: "800", color: T.brand },
});