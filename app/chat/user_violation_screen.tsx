// screens/user_violation_screen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import ReusableScreen from "@/components/ReusableScreen";

// ─── Support contact ──────────────────────────────────────────────────────────
const SUPPORT_EMAIL = "support@smartlearnersapp.com";
const SUPPORT_WHATSAPP = "233502309630"; // international format, no +

export default function UserViolationScreen() {
  const params = useLocalSearchParams<{
    email1: string;
    email2: string;
    blockedEmail: string;
  }>();

  const email1 = params.email1 ?? "—";
  const email2 = params.email2 ?? "—";
  const blockedEmail = params.blockedEmail ?? "—";

  const [expanded, setExpanded] = useState(false);

  const handleContactEmail = () => {
    const subject = encodeURIComponent("Device Limit — Account Appeal");
    const body = encodeURIComponent(
      `Hi Support,\n\nI have reached the 2-email device limit on my device.\n\nBlocked email: ${blockedEmail}\n\nPlease assist me.\n\nThank you.`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const handleContactWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hi, I have reached the 2-email device limit. Blocked email: ${blockedEmail}. Please help.`
    );
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`);
  };

  return (
    <ReusableScreen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Shield icon ── */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="security" size={56} color="#e81e04ff" />
          </View>
          <View style={styles.badgeWrap}>
            <MaterialIcons name="block" size={24} color="#fff" />
          </View>
        </View>

        {/* ── Title ── */}
        <Text style={styles.title}>Device Limit Reached</Text>
        <Text style={styles.subtitle}>
          This device has already been registered with{" "}
          <Text style={styles.bold}>2 email addresses</Text>. A third account
          cannot be created or accessed from this device.
        </Text>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Registered emails ── */}
        <Text style={styles.sectionTitle}>Emails Registered on This Device</Text>

        <View style={styles.emailCard}>
          <View style={styles.emailRow}>
            <View style={[styles.emailBadge, { backgroundColor: "#1ab605ff" }]}>
              <Text style={styles.emailBadgeText}>1</Text>
            </View>
            <View style={styles.emailTextWrap}>
              <Text style={styles.emailLabel}>Registered Account</Text>
              <Text style={styles.emailValue} numberOfLines={1}>{email1}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#1ab605ff" />
          </View>

          <View style={styles.emailDivider} />

          <View style={styles.emailRow}>
            <View style={[styles.emailBadge, { backgroundColor: "#1ab605ff" }]}>
              <Text style={styles.emailBadgeText}>2</Text>
            </View>
            <View style={styles.emailTextWrap}>
              <Text style={styles.emailLabel}>Registered Account</Text>
              <Text style={styles.emailValue} numberOfLines={1}>{email2}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#1ab605ff" />
          </View>
        </View>

        {/* ── Blocked email ── */}
        <View style={styles.blockedCard}>
          <View style={styles.emailRow}>
            <View style={[styles.emailBadge, { backgroundColor: "#e81e04ff" }]}>
              <Text style={styles.emailBadgeText}>3</Text>
            </View>
            <View style={styles.emailTextWrap}>
              <Text style={[styles.emailLabel, { color: "#e81e04ff" }]}>
                Blocked — Limit Exceeded
              </Text>
              <Text style={[styles.emailValue, { color: "#e81e04ff" }]} numberOfLines={1}>
                {blockedEmail}
              </Text>
            </View>
            <MaterialIcons name="block" size={20} color="#e81e04ff" />
          </View>
        </View>

        {/* ── Why this happened ── */}
        <TouchableOpacity
          style={styles.faqToggle}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.faqToggleText}>Why did this happen?</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#7c3aed"
          />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.faqCard}>
            {[
              "To protect the integrity of our platform, each physical device is limited to a maximum of 2 registered accounts.",
              "This policy prevents abuse, ensures fair use of resources, and protects other users on the leaderboard.",
              "Your two existing accounts remain fully functional on this device — only a third account is restricted.",
              "If you believe this is an error, or if you recently changed your device, please contact our support team using the options below.",
              "If you are using a shared or family device, you may need to use a separate device for the third account.",
            ].map((text, i) => (
              <View key={i} style={styles.faqRow}>
                <View style={styles.faqBullet} />
                <Text style={styles.faqText}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Warning box ── */}
        <View style={styles.warningBox}>
          <MaterialIcons name="warning-amber" size={18} color="#b45309" />
          <Text style={styles.warningText}>
            Attempts to bypass this limit may result in a{" "}
            <Text style={{ fontWeight: "700" }}>permanent ban</Text> of all
            accounts associated with this device.
          </Text>
        </View>

        {/* ── Actions ── */}
        <Text style={styles.sectionTitle}>What Can You Do?</Text>

        {/* Use an existing account */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace("/")}
        >
          <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Sign In with an Existing Account</Text>
        </TouchableOpacity>

        {/* Contact support */}
        <View style={styles.supportRow}>
          <TouchableOpacity style={styles.supportBtn} onPress={handleContactEmail}>
            <MaterialIcons name="email" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.supportBtnText}>Email Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.supportBtn, { backgroundColor: "#25d366" }]}
            onPress={handleContactWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.supportBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer note ── */}
        <Text style={styles.footerNote}>
          SmartLearnersApp · Device Policy v1.0{"\n"}
          Each device is permitted a maximum of 2 accounts.
        </Text>
      </ScrollView>
    </ReusableScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 60,
  },

  iconWrap: { position: "relative", marginBottom: 20 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#fff1f0",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#fca5a5",
    shadowColor: "#e81e04", shadowOpacity: 0.15,
    shadowRadius: 12, elevation: 4,
  },
  badgeWrap: {
    position: "absolute", bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#e81e04ff",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#fff",
  },

  title: {
    fontSize: 24, fontWeight: "800", color: "#111",
    textAlign: "center", marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: "#555", textAlign: "center",
    lineHeight: 22, marginBottom: 6,
  },
  bold: { fontWeight: "700", color: "#111" },

  divider: {
    width: "100%", height: 1,
    backgroundColor: "#f0f0f0", marginVertical: 20,
  },

  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#999",
    textTransform: "uppercase", letterSpacing: 0.8,
    alignSelf: "flex-start", marginBottom: 10,
  },

  emailCard: {
    width: "100%", backgroundColor: "#fff",
    borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0",
    overflow: "hidden", marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  emailRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  emailBadge: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  emailBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  emailTextWrap: { flex: 1 },
  emailLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  emailValue: { fontSize: 14, fontWeight: "600", color: "#111" },
  emailDivider: { height: 1, backgroundColor: "#f5f5f5", marginHorizontal: 14 },

  blockedCard: {
    width: "100%", backgroundColor: "#fff1f0",
    borderRadius: 14, borderWidth: 1.5, borderColor: "#fca5a5",
    overflow: "hidden", marginBottom: 20,
  },

  faqToggle: {
    width: "100%", flexDirection: "row",
    justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#f5f3ff", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 6,
  },
  faqToggleText: { fontSize: 14, fontWeight: "600", color: "#7c3aed" },

  faqCard: {
    width: "100%", backgroundColor: "#fafafa",
    borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#ebebeb",
    marginBottom: 16, gap: 10,
  },
  faqRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  faqBullet: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#7c3aed", marginTop: 6, flexShrink: 0,
  },
  faqText: { flex: 1, fontSize: 13, color: "#444", lineHeight: 20 },

  warningBox: {
    width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fefce8", borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: "#f5a623ff",
    marginBottom: 20,
  },
  warningText: { flex: 1, fontSize: 12, color: "#78350f", lineHeight: 18 },

  primaryBtn: {
    width: "100%", flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#f97316",
    borderRadius: 14, paddingVertical: 13,
    marginBottom: 12,
    shadowColor: "#f97316", shadowOpacity: 0.35,
    shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  supportRow: {
    width: "100%", flexDirection: "row", gap: 10, marginBottom: 24,
  },
  supportBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", backgroundColor: "#2076efff",
    borderRadius: 12, paddingVertical: 11,
  },
  supportBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  footerNote: {
    fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 17,
  },
});
