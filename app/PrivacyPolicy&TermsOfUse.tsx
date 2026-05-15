import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import ReusableScreen from "@/components/ReusableScreen";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function PolicyTermsScreen() {
  return (
    <ReusableScreen>

      {/* ===== FIXED HEADER ===== */}
      <View style={styles.fixedHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "center" }}><Ionicons
          name="arrow-back"
          size={24}
          color="#fff"
          onPress={() => router.back()}
        /><Text style={styles.headerTitle}> Privacy Policy & Terms of Use</Text></View>
        <Text style={styles.subHeader}>Smart People</Text>
      </View>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollArea}
      >

        {/* PRIVACY POLICY */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>

          <Text style={styles.text}>
            <Text style={styles.bold}>Effective Date:</Text> November 2, 2025{"\n"}
            <Text style={styles.bold}>Developer:</Text> SmartPeople Limited{"\n"}
            <Text style={styles.bold}>Contact:</Text> stanleyafon@gmail.com | +233 543 171 076
          </Text>

          <Text style={styles.sectionHeader}>1. Introduction</Text>
          <Text style={styles.text}>
            SmartPeople Limited (“we,” “our,” or “us”) respects your privacy and is
            committed to protecting your personal data. This Privacy Policy explains how we
            collect, use, store, and protect your information when you use the Smart People App.
          </Text>

          <Text style={styles.sectionHeader}>2. Information We Collect</Text>
          <Text style={styles.text}>
            • Personal Information: full name, email address, phone number, profile photo, and payment details.{"\n"}
            • Usage Information: quiz data, device info, IP address, app usage statistics.{"\n"}
            • Optional Data: reward verification details.
          </Text>

          <Text style={styles.sectionHeader}>3. How We Use Your Information</Text>
          <Text style={styles.text}>
            • Create and manage accounts {"\n"}
            • Verify reward eligibility {"\n"}
            • Deliver educational content {"\n"}
            • Improve app performance {"\n"}
            • Communicate important updates {"\n"}
            We do not sell or rent user data.
          </Text>

          <Text style={styles.sectionHeader}>4. Reward Payments</Text>
          <Text style={styles.text}>
            Reward verification may require additional data. Payments may be processed via Mobile Money,
            Crypto, or PayPal. Data is deleted when no longer needed.
          </Text>

          <Text style={styles.sectionHeader}>5. Data Storage & Security</Text>
          <Text style={styles.text}>
            We use encryption and secure systems to safeguard data, though no system is 100% secure.
          </Text>

          <Text style={styles.sectionHeader}>6. Sharing of Information</Text>
          <Text style={styles.text}>
            We may share limited data with service providers or when required by law. No marketing sharing without consent.
          </Text>

          <Text style={styles.sectionHeader}>7. Your Rights</Text>
          <Text style={styles.text}>
            You may request access, edits, deletion, or account closure via: stanleyafon@gmail.com.
          </Text>

          <Text style={styles.sectionHeader}>8. Children’s Privacy</Text>
          <Text style={styles.text}>
            App is for ages 8+. Data from minors under 8 is deleted.
          </Text>

          <Text style={styles.sectionHeader}>9. Data Retention</Text>
          <Text style={styles.text}>
            Data is retained only as needed for legal or operational reasons.
          </Text>

          <Text style={styles.sectionHeader}>10. Third-Party Services</Text>
          <Text style={styles.text}>
            We are not responsible for privacy practices of external services linked through the App.
          </Text>

          <Text style={styles.sectionHeader}>11. Updates to Policy</Text>
          <Text style={styles.text}>
            Continued use after updates signifies acceptance.
          </Text>

          <Text style={styles.sectionHeader}>12. Contact Us</Text>
          <Text style={styles.text}>
            Email: stanleyafon@gmail.com {"\n"}
            Phone: +233 543 171 076
          </Text>
        </View>

        {/* TERMS AND CONDITIONS */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>

          <Text style={styles.text}>
            <Text style={styles.bold}>Effective Date:</Text> November 2, 2025{"\n"}
            <Text style={styles.bold}>Developer:</Text> SmartPeople Limited{"\n"}
            <Text style={styles.bold}>Contact:</Text> stanleyafon@gmail.com | +233 543 171 076
          </Text>

          <Text style={styles.sectionHeader}>1. Acceptance of Terms</Text>
          <Text style={styles.text}>
            By using the Smart People App, you agree to these Terms. Updates may occur at any time.
          </Text>

          <Text style={styles.sectionHeader}>2. About Smart People</Text>
          <Text style={styles.text}>
            The App offers quizzes, challenges, and competitions. Free to use, account required for full features.
          </Text>

          <Text style={styles.sectionHeader}>3. Eligibility</Text>
          <Text style={styles.text}>
            Users must be at least 8. Registration requires accurate information.
          </Text>

          <Text style={styles.sectionHeader}>4. Account Registration</Text>
          <Text style={styles.text}>
            • Provide accurate details {"\n"}
            • Keep login credentials secure {"\n"}
            • We are not liable for unauthorized access from user negligence
          </Text>

          <Text style={styles.sectionHeader}>5. Quiz Rules & Rewards</Text>
          <Text style={styles.text}>
            • Participate in quizzes to earn rewards {"\n"}
            • Answer 5 questions correctly for an instant reward of $5 {"\n"}
            • $10 to $200 top scorer prize every 30 days {"\n"}
            • Payments via Mobile Money, Crypto, PayPal {"\n"}
            • Fraud results in disqualification {"\n"}
            • Reward programs may change anytime
          </Text>

          <Text style={styles.sectionHeader}>6. User Conduct</Text>
          <Text style={styles.text}>
            Users must not post harmful content or disrupt the App.
          </Text>

          <Text style={styles.sectionHeader}>7. Intellectual Property</Text>
          <Text style={styles.text}>
            All content is owned by SmartPeople Limited. Do not copy or redistribute without permission.
          </Text>

          <Text style={styles.sectionHeader}>8. Privacy & Data</Text>
          <Text style={styles.text}>
            Personal data is used only for account management and reward verification.
          </Text>

          <Text style={styles.sectionHeader}>9. Limitation of Liability</Text>
          <Text style={styles.text}>
            We are not responsible for data loss, reward loss, or indirect damages.
          </Text>

          <Text style={styles.sectionHeader}>10. Termination</Text>
          <Text style={styles.text}>
            Accounts may be terminated for rule violations. Users may request deletion anytime.
          </Text>

          <Text style={styles.sectionHeader}>11. Governing Law</Text>
          <Text style={styles.text}>
            Governed by the laws of Ghana.
          </Text>

          <Text style={styles.sectionHeader}>12. Contact Us</Text>
          <Text style={styles.text}>
            Email: stanleyafon@gmail.com {"\n"}
            Phone: +233 543 171 076
          </Text>
        </View>

      </ScrollView>

      {/* ===== FIXED FOOTER ===== */}
      <View style={styles.fixedFooter}>
        <View style={styles.footerSection}>
          <Text style={styles.footerText}>© 2025 Smart People</Text>
          <Text style={styles.footerText}>
            Empowering Students to Learn Smarter
          </Text>

        </View>
      </View>

    </ReusableScreen>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
    marginTop: 80,    // keeps content below fixed header
    marginBottom: 60,  // avoids footer overlap
  },
  scrollContent: {
    padding: 20,
  },
  footerSection: {
    alignItems: "center",
    // marginTop: 6,
  },
  /* ----- Fixed Header ----- */
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 18,
    backgroundColor: "#fff",
    zIndex: 999,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F97316",
    textAlign: "center",
  },
  subHeader: {
    fontSize: 17,
    color: "#ef9308ff",
    textAlign: "center",
    marginTop: 2,
    fontWeight: "800",
  },

  /* ----- Fixed Footer ----- */
  fixedFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 14,
    backgroundColor: "#fff",
    zIndex: 999,
    elevation: 6,
  },
  footerText: {
    textAlign: "center",
    color: "#F97316",
    fontSize: 15,
    fontWeight: "600",
  },

  /* ----- Orange UI Styling ----- */
  sectionBox: {
    backgroundColor: "#fff7ef",
    padding: 16,
    borderRadius: 14,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ffcf9b",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#d45500",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 15,
    //marginBottom: 6,
    color: "#ff8c00",
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
  },
  bold: {
    fontWeight: "700",
  },
});
