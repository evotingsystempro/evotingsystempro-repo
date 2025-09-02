import React, { useContext, useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Pressable,
  Animated,
  useWindowDimensions,
  Image,
} from "react-native";
import {
  MaterialCommunityIcons,
  Ionicons,
  AntDesign,
  FontAwesome,
  Feather,
} from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/auth";

export default function LoginScreen() {
 
  const { user, isLoading,signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [secure, setSecure] = useState(true);
  let intervalId: string | number | NodeJS.Timeout | undefined;
 const [loading, setLoading] = useState(false); // 👈 new loading state
 const [loadingView, setLoadingView] = useState(true); // 👈 new loading state
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const contentWidth = isWeb ? Math.min(width, 420) : width;

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      fadeAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, [fadeAnim])
  );

  // Helper: fade out before navigating
  const fadeOutAndNavigate = (path: any) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  // LOGIN
  const handleLogin = async () => {
    setError("Logging in...");
    if (email.trim() === "" || password.trim() === "") {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
  };

   useFocusEffect(
    useCallback(() => {
      setLoadingView(false)
    }, [])
  );

   useFocusEffect(
    useCallback(() => {
      if(user?.name){
        console.log(":::::user in login",user)
          router.push("/chat/chat_list");
      }
    }, [user?.name])
  );

  const signInHandle=()=>{
     setLoadingView(true)
    signIn();
  }

  return (
    
    <View style={styles.outer}>
    { loadingView == true? 
    (
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",position:"absolute",zIndex:1,width:"100%",height:"100%"
        }}
      >
        <ActivityIndicator size="large" color="#099750" />
        <Text style={{ marginTop: 12, fontSize: 16, color: "#099750" }}>
          Loading...
        </Text>
      </View>
    ):""
  }
      <Animated.View style={[styles.container, { opacity: fadeAnim, width: contentWidth }]}>
        <View style={styles.safeArea}>
          <ImageBackground
            source={require("../assets/backgroundImages/l.jpg")}
            style={styles.background}
            blurRadius={0}
          >
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView contentContainerStyle={styles.innerContainer}>
 
                <View style={{ paddingHorizontal: 20 }}>
                  {/* Logo */}
                  <View style={{ alignItems: "center", marginBottom: 70 }}>
                    <View style={styles.iconContainer}>
                      <Image
                        source={require("../assets/images/vrdraughtlogo.png")}
                        style={{ width: 90, height: 90, resizeMode: "contain" }}
                      />
                    </View>
                  </View>

                  {/* App name */}
                  <Text style={styles.appName}>VR-Draught</Text>
                  <Text style={styles.title}>Login</Text>

                  {/* Register link */}
                  <View style={styles.inlineContainer}>
                    <Text style={styles.subText}>Not registered yet?</Text>
                    <Pressable
                      style={styles.linkButton}
                      onPress={() => fadeOutAndNavigate("./register")}
                    >
                      <Text style={styles.link}>Register</Text>
                    </Pressable>
                  </View>

                  {/* Email */}
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons
                      name="email-outline"
                      size={20}
                      color="#999"
                      style={styles.icon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#aaa"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  {/* Password */}
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={20}
                      color="#999"
                      style={styles.icon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#aaa"
                      secureTextEntry={secure}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setSecure(!secure)}>
                      <Ionicons
                        name={secure ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#999"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Error */}
                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Login button */}
                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.loginText}>Login</Text>
                    )}
                  </TouchableOpacity>

                  {/* Social login */}
                  <Text style={styles.orText}>
                "Or Login with"
                  </Text>

                  <View style={{ flexDirection: "row", alignSelf: "center" }}>
                    <TouchableOpacity
                      onPress={signInHandle}
                      style={styles.socialButton}
                    >
                      <AntDesign name="google" size={28} color="#DB4437" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialButton}>
                      <FontAwesome
                        name="facebook-square"
                        size={28}
                        color="#1877F2"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialButton}>
                      
                      <AntDesign name="apple1" size={28} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>

              </ScrollView>
            </KeyboardAvoidingView>
          </ImageBackground>
        </View>
      </Animated.View>
    </View>
    
  );
  
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center", // centers the mobile container on web
    backgroundColor: "#f2f2f2", // light gray like WhatsApp web
  },
  container: {
    flex: 1,
    backgroundColor: "#000", // ensures background works well with image overlay
    maxWidth: 420, // lock to phone width
    justifyContent: "flex-start",
  },
  safeArea: { flex: 1 },
  background: {
    flex: 1,
    width: "100%", // ✅ span full screen
    height: "100%",

  },
  innerContainer: { flexGrow: 1, justifyContent: "center" },
  appName: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#fff",
    textAlign: "center",
  },
  inlineContainer: {
    flexDirection: "row",
    marginBottom: 15,
    justifyContent: "center",
  },
  subText: { fontSize: 16, color: "#fff" },
  link: {
    color: "#FFEB3B",
    fontWeight: "bold",
    marginLeft: 6,
    textDecorationLine: "underline",
  },
  linkButton: { paddingHorizontal: 4 },
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
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 12 },
  errorContainer: { alignSelf: "center", marginBottom: 10 },
  errorText: { color: "yellow", fontSize: 16, fontWeight: "600" },
  loginButton: {
    backgroundColor: "green",
    paddingVertical: 15,
    marginHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 15,
  },
  loginText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  orText: {
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 15,
    fontSize: 18,
    color: "#ffe600ff",
  },
  socialButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginHorizontal: 5,
  },
  iconContainer: {
    width: 100,
    height: 100,
    backgroundColor: "rgba(255, 255, 255, 0.17)",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  // Welcome screen styles
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  welcomeTitle: {
    fontSize: 32,
    color: "white",
    fontWeight: "bold",
    marginTop: 30,
    marginBottom: 10,
  },
  welcomeSubtitle: {
    marginHorizontal: 30,
    fontSize: 19,
    lineHeight: 32,
    color: "white",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 40,
  },
  continueButton: {
    backgroundColor: "green",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: "yellow",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 10,
  },
  continueText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
