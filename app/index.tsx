import React, { useContext, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlobalContext } from "@/context";

export default function IndexScreen() {
  const router = useRouter();

  const {
    isLoading,
    userId,
  } = useContext(GlobalContext);


  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  // ------------------------------------------------
  // Splash animations & navigation
  // ------------------------------------------------
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 10,
        friction: 1,
        useNativeDriver: true,
      }),
    ]).start();

    if (isLoading) return;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;

      if (!userId) {
        //  console.log(":::::: No User ::::::");
        router.replace("/loginHome");
      } else {
        // console.log(":::::: User exists xxx ::::::", { userId });
        router.replace("/chat/welcome");
      }
    });
  }, [isLoading, userId]);

  // ------------------------------------------------
  // 🧩 UI
  // ------------------------------------------------
  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Ionicons name="shield-checkmark-sharp" size={50} color="#fd8c02ff" />
        <Text style={styles.appName}>
          {Platform.OS === "web" ? "Loading App..." : "Loading App..."}
        </Text>
      </Animated.View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef5f0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
  },
  appName: {
    color: "#fd8c02ff",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
    letterSpacing: 1,
    textAlign: "center",
  },
});
