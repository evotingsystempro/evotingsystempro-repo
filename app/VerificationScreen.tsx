import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

//const SERVER_URL = "http://172.20.135.68:8080";
const SERVER_URL = "https://email-service-405496305969.us-central1.run.app";

export default function VerificationScreen() {
  const router = useRouter();
  const { username, email, password } = useLocalSearchParams();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(180); // 3 minutes

  // Reset error/success when user types
  useEffect(() => {
    if (error || success) {
      setError("");
      setSuccess("");
    }
  }, [code]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  //-- Verify code function
  const verifyCode = async () => {
  if (!code.trim()) {
    setError("Please enter the verification code");
    return;
  }
  setLoading(true);
  try {
    const res = await fetch(`${SERVER_URL}/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }), // include password for validation
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // setTimeout(() => router.replace("/login"), 1000);
      setSuccess("Verification successful!");
      setCountdown(0); // Stop timer on success
    } else {
      setError(data.error || "Invalid code, please try again");
    }
  } catch {
    setError("Network error, please try again");
  } finally {
    setLoading(false);
  }
};

//--- Resend code function
  const resendCode = async () => {
     setError("");
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess("A new verification code has been sent!");
        setCountdown(180); // Restart timer after resend
      } else {
        setError(data.error || "Failed to resend code");
      }
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  };

  //--- Cancel Email Verification function
 const cancelEmailVerification = async () => {
  setLoading(true);
  try {
    const res = await fetch(`${SERVER_URL}/cancel-email-verification`, {
      method: "POST", // must match backend
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }), //tell server which verification to cancel
    });

    const data = await res.json();
    if (res.ok && data.success) {
     // setSuccess(data.message);
    //  setCountdown(0); 
     // setTimeout(() => router.replace("/login"), 200);
    } else {
      setError(data.error || "Failed to cancel verification");
    }
  } catch {
    setError("Cancellation failed, network error");
  } finally {
    setLoading(false);
  }
};


  return (
    <ImageBackground
      source={require("../assets/backgroundImages/o.jpg")}
      style={styles.background}
      blurRadius={0}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="pulse-outline" size={40} color="white" />
            </View>
            <Text style={styles.appName}>VR-Draught</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            Enter the code sent to{" "}
            <Text style={{ fontWeight: "bold" }}>{email}</Text>
          </Text>

          {/* Verification Code Input */}
          <View style={styles.inputWrapper}>
            <Ionicons name="key-outline" size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="Verification Code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
          </View>

          {/* Show Verify only when countdown > 0 */}
          {countdown > 0 && (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={verifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Show Resend only when countdown === 0 */}
          {countdown === 0 ? (
            <TouchableOpacity
              onPress={resendCode}
              style={[styles.button, { backgroundColor: "#FFD700" }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={[styles.buttonText, { color: "#000" }]}>
                  Resend Code
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend available in {Math.floor(countdown / 60)}:
              {String(countdown % 60).padStart(2, "0")}
            </Text>
          )}

          {/* Error / Success Messages */}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          {/* Back to Login */}
          <TouchableOpacity
            style={{ marginTop: 30 }}
            onPress={() => cancelEmailVerification()}
          >
            <Text style={styles.loginText}>Cancel email verification</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "white",
    textAlign: "center",
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 25,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    height: 45,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#03cc82ff",marginHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonDisabled: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  timerText: { color: "white",fontSize: 18, textAlign: "center", marginTop: 10 },
  error: { color: "#ffd900ff",fontWeight:"700", marginTop: 10, textAlign: "center",fontSize: 18 },
  success: { color: "#22ff00ff", marginTop: 10, textAlign: "center",fontSize: 18  },
  loginText: {textDecorationLine:"underline", color: "#FFD700", textAlign: "center", fontSize: 18 },
});
