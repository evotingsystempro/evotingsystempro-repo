import React, { useState, useRef, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { gameResults } from "@/components/gameResults";
import { logoutUser } from "@/utils/logoutUser";
//import { GlobalContext, useAuth } from "@/context/auth";
import { BASE_URL } from "@/utils/constants";
import { useAuth } from "@/context/auth";

export default function GradingScreen() {
  const [filter, setFilter] = useState<"All" | "Paid" | "Owing" | "Top">("All");
  const [yearFilter, setYearFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const tabRefs = useRef<Record<string, View | null>>({});
  const scaleAnim = useRef<Record<string, Animated.Value>>({}).current;
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const { user, signOut } =useAuth();


  // ✅ internal state so we can update points
  const [results, setResults] = useState(gameResults);

  // always restrict to mobile size
  const contentWidth = isWeb ? Math.min(width, 420) : width;

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, []);

  ["All", "Paid", "Owing", "Top"].forEach((label) => {
    if (!scaleAnim[label]) {
      scaleAnim[label] = new Animated.Value(1);
    }
  });

  const handleTabPress = (label: "All" | "Paid" | "Owing" | "Top") => {
    // Recalculate winnerPoint AND loserPoint when "Top" is pressed
    if (label === "Top") {
      const winCounts: Record<string, number> = {};
      results.forEach((g) => {
        winCounts[g.winnerName] = (winCounts[g.winnerName] || 0) + 1;
      });

      const updatedResults = results.map((g) => ({
        ...g,
        // assign how many times each person has won (string to match current code)
        winnerPoint: (winCounts[g.winnerName] || 0).toString(),
        loserPoint: (winCounts[g.loserName] || 0).toString(),
      }));

      setResults(updatedResults);
    } else {
      // reset to original dataset for other filters
      setResults(gameResults);
    }

    setFilter(label);

    Animated.spring(scaleAnim[label], {
      toValue: 1.2,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(scaleAnim[label], {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });
  };

  const getFilteredResults = () => {
    let filtered = results;

    if (filter === "Paid")
      filtered = filtered.filter((g) => g.loserObligation === "Paid");
    if (filter === "Owing")
      filtered = filtered.filter((g) => g.loserObligation === "Owing");
    if (filter === "Top")
      filtered = [...filtered].sort(
        (a, b) => Number(b.winnerPoint) - Number(a.winnerPoint)
      );

    if (yearFilter.trim() !== "")
      filtered = filtered.filter((g) => g.year.toString() === yearFilter.trim());
    if (nameFilter.trim() !== "")
      filtered = filtered.filter(
        (g) =>
          nameFilter.trim() === g.winnerName || nameFilter.trim() === g.loserName
      );

    return filtered;
  };

  const getCount = (label: "All" | "Paid" | "Owing" | "Top") => {
    let dataset = gameResults;
    if (label === "Paid")
      dataset = dataset.filter((g) => g.loserObligation === "Paid");
    if (label === "Owing")
      dataset = dataset.filter((g) => g.loserObligation === "Owing");
    if (label === "Top" || label === "All") dataset = gameResults;
    return dataset.length;
  };

 

/*  useEffect(() => {
    if (Platform.OS !== "web" && !user) {
      router.replace("../login");
    }
  }, [user]);

  useEffect(() => {
    if (Platform.OS == "web") {
      const signOutAndRedirect = async () => {
        try {
          console.log("Performing web logout sync...");
          await fetch(`${BASE_URL}/login`, {
            method: "POST",
          });
        } catch (err) {
          console.error("Logout sync failed:", err);
        }finally {
          router.replace("../login");
        }
      };
      signOutAndRedirect();
    }
  }, []);
*/

 useFocusEffect(
    useCallback(() => {
      if(!user){
          router.replace("../login");
      }
    }, [user])
  );


  const renderItem = ({
    item,
    index,
  }: {
    item: typeof gameResults[0];
    index: number;
  }): any => (
    <View id={index.toString()} style={styles.chatItem}>
      <Image source={item.icon} style={styles.avatar} />
      <View style={styles.textContainer}>
        <Text style={styles.chatName}>
          {item.winnerName}
          <Text style={styles.score}> {item.winnerScores}</Text>{" "}
          <Text style={styles.details}>
            point: {item.winnerPoint} - {item.winnerRank}
          </Text>
        </Text>

        <Text style={styles.chatName}>
          {item.loserName}
          <Text style={styles.score}> {item.loserScores}</Text>{" "}
          <Text style={styles.details}>
            point: {item.loserPoint} - {item.loserRank}
          </Text>{" "}
          <Text
            style={[
              styles.obligation,
              {
                color: item.loserObligation === "Owing" ? "red" : "#099750c7",
              },
            ]}
          >
            ({item.loserObligation})
          </Text>
        </Text>
      </View>
      <Text style={styles.timeText}>{item.date}</Text>
    </View>
  );

  return (
    <View style={styles.outer}>
      <Animated.View
        style={[styles.container, { opacity: fadeAnim, width: contentWidth }]}
      >
        {/* Filter Tabs */}
        <View style={styles.headerScrollContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{
              paddingHorizontal: 5,
              alignItems: "center",
            }}
          >
            {(["All", "Paid", "Owing", "Top"] as const).map((label) => (
              <View
                key={label}
                style={{
                  alignItems: "center",
                  marginRight: 8,
                  marginTop: 5, paddingBottom: 8,
                }}
              >
                <TouchableOpacity onPress={() => handleTabPress(label)}>
                  <Animated.View
                    style={[
                      styles.headerButtonWrapper,
                      filter === label && styles.activeHeaderButtonWrapper,
                      { transform: [{ scale: scaleAnim[label] }] },
                    ]}
                  >
                    <Text style={styles.headerButtonText}>{label}</Text>
                  </Animated.View>
                </TouchableOpacity>
                <Text style={styles.countText}>{getCount(label)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", position: "relative", bottom: 8 }}>
              <TextInput
                placeholder="eg.2025"
                value={yearFilter}
                onChangeText={setYearFilter}
                maxLength={4}
                keyboardType="numeric"
                style={styles.yearInput}
              />
              <TextInput
                placeholder="eg.John"
                value={nameFilter}
                onChangeText={setNameFilter}
                maxLength={25}
                style={styles.nameInput}
              />
            </View>

          </ScrollView>
        </View>

        {/* Filtered List */}
        <FlatList
          data={getFilteredResults()}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          style={styles.chatList}
        />

        {/* Bottom Nav */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            onPress={() => router.navigate("./chat_room")}
            style={styles.navItem}
          >
            <Ionicons name="chatbox-outline" size={24} color="#333" />
            <Text style={styles.navText}>Chats</Text>
          </TouchableOpacity>
          <View style={styles.navItem}>
            <Ionicons name="albums" size={24} color="#333" />
            <Text style={styles.navText}>Updates</Text>
          </View>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="people" size={24} color="#333" />
            <Text style={styles.navText}>Communities</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>signOut()} style={styles.navItem}>
            <Ionicons name="log-out-outline" size={24} color="#333" />
            <Text style={styles.navText}>Calls</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center", // centers the mobile container on web
    backgroundColor: "#f2f2f2", // gray bg like WhatsApp web
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    maxWidth: 420, // lock max width like a phone
    justifyContent: "flex-start",
  },
  headerScrollContainer: {
    alignItems: "flex-start",
    paddingTop: 15,
    backgroundColor: "#fff",
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
    overflow: "hidden",
  },
  headerContent: { flexDirection: "row", alignItems: "center" },
  headerButtonWrapper: {
    alignItems: "center",
    backgroundColor: "#09975078",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  activeHeaderButtonWrapper: { backgroundColor: "#099750ff" },
  headerButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  countText: { fontSize: 12, color: "#999", fontWeight: "600", marginTop: 2 },
  yearInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    marginLeft: 8,
    width: 90,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    marginLeft: 8,
    width: 180,
  },
  chatList: { flex: 1 },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  textContainer: { flex: 1 },
  chatName: { fontWeight: "500", fontSize: 16 },
  score: { fontSize: 16, fontWeight: "800", color: "black" },
  details: { fontSize: 13, color: "gray", fontWeight: "400", fontStyle: "italic" },
  obligation: { fontSize: 15, fontStyle: "italic" },
  timeText: { fontSize: 12, color: "gray", marginLeft: 5 },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    backgroundColor: "#fff",
  },
  navItem: { alignItems: "center" },
  navText: { fontSize: 13, color: "#222", marginTop: 2, fontWeight: "600" },
});
