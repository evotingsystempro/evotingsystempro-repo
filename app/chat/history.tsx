import React, { useCallback, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { GlobalContext } from "@/context";
import ReusableScreen from "@/components/ReusableScreen";
import ChatBanner from "@/components/ChatBanner";

export default function HistoryScreen() {
  const { attemptHistory, clearHistory, rawUserEmail } =
    useContext(GlobalContext);

  // 🔐 Guard: redirect if not logged in
  useFocusEffect(
    useCallback(() => {
      if (!rawUserEmail) {
        router.replace("/");
      }
    }, [rawUserEmail])
  );

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleString();

  return (
    <ReusableScreen>
      <ChatBanner />
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Attempt History</Text>
        <Text style={styles.headerSubtitle}>
          Review your attempts and performance
        </Text>
      </View>

      {/* History Section */}
      <View style={styles.contentContainer}>
        {attemptHistory.length > 0 ? (
          <View style={styles.tableCard}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 1 }]}>#</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>Score</Text>
              <Text style={[styles.headerCell, { flex: 2 }]}>Date</Text>
            </View>

            {/* Table Rows */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollContainer}
            >
              {attemptHistory.map((attempt: any, index: number) => (
                <View
                  key={`${attempt.timestamp}-${index}`}
                  style={[
                    styles.tableRow,
                    index % 2 !== 0 && styles.altRow,
                  ]}
                >
                  <Text style={[styles.cell, { flex: 1 }]}>
                    {attemptHistory.length - index}
                  </Text>
                  <Text style={[styles.cell, { flex: 1 }]}>
                    {attempt.score}/{attempt.total}
                  </Text>
                  <Text style={[styles.cell, { flex: 2 }]}>
                    {formatDate(attempt.timestamp)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noHistory}>No attempts yet..</Text>
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={() => router.navigate({ pathname: "/chat/quiz" })}
        >
          <Text style={styles.buttonText}>Back to Task</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.clearButton,
            attemptHistory.length === 0 && { opacity: 0.5 },
          ]}
          onPress={clearHistory}
          disabled={attemptHistory.length === 0}
        >
          <Text style={styles.buttonText}>Clear History</Text>
        </TouchableOpacity>
      </View>
    </ReusableScreen>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 10,
    marginTop: 25,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },

  contentContainer: {
    flex: 1,
    paddingHorizontal: 12,
    marginTop: 10,
  },

  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
    overflow: "hidden",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  headerCell: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },

  scrollContainer: {
    flexGrow: 0,
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  altRow: {
    backgroundColor: "#FAFAFA",
  },

  cell: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },

  noDataContainer: {
    alignItems: "center",
    marginTop: 60,
  },

  noHistory: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  noHistorySub: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 6,
  },

  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 70,
    marginTop: 20,
    marginBottom: 10,
    gap: 10,
  },

  button: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 50,
    alignItems: "center",
  },

  backButton: {
    backgroundColor: "#3B82F6",
  },

  clearButton: {
    backgroundColor: "#fa2c2cff",
  },

  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
