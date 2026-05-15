// components/BottomNav.tsx
import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { GlobalContext } from "@/context/index";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/auth";

export default function BottomNavQuiz() {

  const pathname = usePathname();
  const { setClientName, setClientId } = useContext(GlobalContext);

  const isWeb = Platform.OS === "web";

  const { user } = useAuth();

  const isActive = (route: string) =>
    pathname.includes(route.replace("./", ""));
  const getColor = (route: string) =>
    isActive(route) ? "#099750" : "#333";

  const commentHandle = async () => {
    setClientName(user?.name || "Guest");
    setClientId(user?.sub,);

    if (isWeb) {
      sessionStorage.setItem("navigatedToChat", "true");
    } else {
      await AsyncStorage.setItem("navigatedToChat", "true");
    }

    router.replace("./comments");
  };

  return (
    <View style={styles.bottomNav}>
      {/* Members */}


      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.replace("./profile")}
      >
        <Ionicons name="person-outline" size={24} color={"#555"} />
        <Text style={[styles.navText, { color: "#555" }]}>
          Profile
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.replace("./scoreboard_stable")}
      >
        <Ionicons name="sync-outline" size={24} color={"#555"} />
        <Text style={[styles.navText, { color: "#555" }]}>
          Scoreboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.replace("./commentScreenGate")}
      >
        <Ionicons
          name="chatbox-outline"
          size={24}
        />
        <Text style={[styles.navText, { color: "#555" }]}>
          Comment
        </Text>
      </TouchableOpacity>




      {/* Activity */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.replace("./history")}
      >
        <Ionicons
          name="stats-chart"
          size={24}
        />
        <Text style={[styles.navText]}>
          History
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    backgroundColor: "#fff",
  },
  navItem: { alignItems: "center" },
  navText: { fontSize: 13, marginTop: 2, fontWeight: "600" },
});
