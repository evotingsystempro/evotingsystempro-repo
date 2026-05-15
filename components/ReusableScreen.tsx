// components/ReusableScreen.tsx
import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReusableScreen({ children }: { children: React.ReactNode }) {
  const { height, width } = useWindowDimensions();
  const withProcessed = width - width * 0.75;
  const screenWidth = !width
    ? 400
    : width <= height
      ? width
      : Math.max(withProcessed, 400);

  /* ── Web: keep <meta name="theme-color"> white at all times ── */
  useEffect(() => {
    if (Platform.OS !== "web") return;

    let meta = document.querySelector(
      'meta[name="theme-color"]'
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = "#ffffff";

    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = "#ffffff";
    body.style.backgroundColor = "#ffffff";

    return () => {
      if (meta) meta.content = prev;
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, []);

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={[styles.container, { width: screenWidth }]}>
          {children}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ddd",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
