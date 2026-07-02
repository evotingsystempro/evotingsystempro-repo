//loginHome.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
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
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { GlobalContext } from "@/context";
import ReusableScreen from "@/components/ReusableScreen";

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
          // NOTE: was `position: "relative"`, which meant every dot first
          // took up space in the parent's normal (column) flow before
          // being nudged by top/left — so all 55 dots stacked down the
          // left edge instead of scattering across the full overlay.
          // "absolute" positions each dot purely by its top/left percent
          // relative to the overlay's bounds, which is what the random
          // scatter math here is actually meant to produce.
          position: "absolute",
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
  const [signingIn, setSigningIn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId) router.replace("/");
    }, [userId])
  );

  // Previously this only logged to console on failure — tapping the
  // button on a failed sign-in (blocked popup, cancelled OAuth flow,
  // dropped network, etc.) looked exactly like nothing happened at all.
  // Now the user gets a visible alert and the button shows a spinner
  // while the request is in flight, so a slow network doesn't look like
  // a dead button either.
  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signIn();
    } catch (err: any) {
      console.error("Google sign-in failed:", err?.message ?? err);
      Alert.alert(
        "Sign-in failed",
        "We couldn't sign you in with Google. Please check your connection and try again."
      );
    } finally {
      setSigningIn(false);
    }
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
              <Image
                source={require("@/assets/images/LOGO.png")}
                style={S.logo}
                resizeMode="contain"
              />
              <Text style={S.appName}>eVoting System Pro</Text>
              <View style={S.heroDivider}>
                <View style={S.heroDividerLine} />
                <View style={S.heroDividerDot} />
                <View style={S.heroDividerLine} />
              </View>
            </View>

            {/* ── Auth Card ── */}
            <View style={S.btnWrapper}>
              {/* Decorative outer ring */}
              <View style={S.btnRingOuter}>
                <View style={S.btnRingInner}>
                  <TouchableOpacity
                    onPress={handleGoogleSignIn}
                    style={S.socialButton}
                    activeOpacity={0.82}
                    disabled={signingIn}
                  >
                    <View style={S.googleIconWrap}>
                      {signingIn ? (
                        <ActivityIndicator size="small" color={T.brand} />
                      ) : (
                        <Image
                          source={require("@/assets/images/google-icon.png")}
                          style={S.logoGoogle}
                        />
                      )}
                    </View>
                    <View style={S.btnTextBlock}>
                      <Text style={S.socialBtnText}>
                        {signingIn ? "Signing in…" : "Continue with Google"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          </View>

          {/* ── Footer ── */}
          <View style={S.footer}>
            <Text style={S.footerCopy}>© 2026 eVoting System Pro</Text>
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
  logo: { width: 70, height: 70, position: "relative", bottom: 30 },
  appName: { fontSize: 25, fontWeight: "800", color: T.brand, letterSpacing: -0.6, marginBottom: 4 },
  heroDivider: { flexDirection: "row", alignItems: "center", gap: 8, width: 120 },
  heroDividerLine: { flex: 1, height: 1, backgroundColor: T.brandBorder, borderRadius: 1 },
  heroDividerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.brandMuted },

  /* ── Button wrapper rings ── */
  btnWrapper: { alignItems: "center" },
  btnRingOuter: {
    // width: "100%",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(118, 219, 172, 0.5)",
    padding: 3,
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
    paddingHorizontal: 12, paddingRight: 20,
    paddingVertical: 7, alignSelf: "center",
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
  logoGoogle: { width: 27, height: 27 },
  // NOTE: was `{ flex: 1 }`. The parent `socialButton` is
  // `alignSelf: "center"` (shrink-to-fit width). Native Yoga (iOS/Android)
  // resolves a flex:1 child inside a shrink-wrap row fine, but
  // react-native-web compiles this to real CSS flexbox, where a flex:1
  // child inside a shrink-to-fit row commonly resolves to width: 0 unless
  // minWidth: 0 is set — the <Text> is in the DOM but invisible because
  // its box has zero width. Dropping flex:1 (with flexShrink so long
  // labels still wrap instead of overflowing) sizes the text to its
  // content consistently on both native and web.
  btnTextBlock: { flexShrink: 1 },
  socialBtnText: { fontSize: 17, color: T.ink, fontWeight: "700" },

  /* ── Footer ── */
  footer: { alignItems: "center", gap: 8 },
  footerCopy: { fontSize: 15, color: T.inkSoft, fontWeight: "500" },
  footerLink: { fontSize: 15, fontWeight: "800", color: T.brand },
});
