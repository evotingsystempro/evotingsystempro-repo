// RootLayout.tsx

import "react-native-gesture-handler"; // ✅ MUST be first
import "react-native-reanimated";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { useColorScheme } from "@/hooks/useColorScheme";
import React, { useEffect, useCallback } from "react";
import { Platform } from "react-native";

import { AuthProvider } from "@/context/auth";
import GlobalState from "@/context";
import { MenuProvider } from "react-native-popup-menu";

import { useFonts, Inter_400Regular } from "@expo-google-fonts/inter";

import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ProfileCompletionProvider } from "@/components/CompleteProfileModal";

SplashScreen.preventAutoHideAsync().catch(() => { });

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    console.log("🔔 Notification listener mounted");

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("📩 Notification received:", response);

        const data = response.notification.request.content.data;

        console.log("📦 Extracted data:", data);

        if (data?.screen) {
          const params = {
            commentId: data.commentId,
            clientName: data.clientName || "",
            clientIconUri: data.clientIconUri || "",
            clientEmail: data.clientEmail || "",
          };

          console.log("➡️ Navigating to:", data.screen);
          console.log("📨 Navigation params:", params);

          router.push({
            pathname: data.screen,
            params,
          });
        } else {
          console.warn("⚠️ No screen provided in notification data");
        }
      }
    );

    return () => {
      console.log("❌ Notification listener removed");
      sub.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AuthProvider>
        <GlobalState>
          <MenuProvider>
            <ProfileCompletionProvider>
              {/* ✅ Orange status bar with white time/icons. translucent=false
                    ensures the colour fills the bar rather than bleeding through. */}
              <StatusBar
                style="light"
                backgroundColor="#f98304"
                translucent={false}
              />

              <Stack
                screenOptions={{
                  headerShown: false,
                  headerShadowVisible: true,
                  animation: "none",
                  headerTitle: "",
                  headerTitleStyle: {
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: "700",
                  },
                  statusBarBackgroundColor: "#f98304",
                  statusBarStyle: "light",
                  headerTintColor: "#fff",
                  navigationBarColor: "#fff",
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="loginHome" options={{ headerShown: false }} />
                <Stack.Screen name="chat/welcome" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="chat/members_list" options={{ headerShown: false }} />
                <Stack.Screen name="chat/comments" options={{ headerShown: false }} />
                <Stack.Screen name="chat/buy_reset_credit_screen" options={{ headerShown: false }} />
                <Stack.Screen name="chat/admin_reset_credit_transaction_screen" options={{ headerShown: false }} />
                <Stack.Screen name="chat/UserTransactionScreen" options={{ headerShown: false }} />
                <Stack.Screen name="chat/user_violation_screen" options={{ headerShown: false }} />
                <Stack.Screen name="chat/profile" options={{ headerShown: false }} />
                <Stack.Screen name="chat/pickTopic" options={{ headerShown: false, }} />
                <Stack.Screen name="chat/quiz" options={{ headerShown: false }} />
                <Stack.Screen name="chat/userChatMessages" options={{ headerShown: false }} />
                <Stack.Screen name="PrivacyPolicy&TermsOfUse" options={{ headerShown: false }} />
              </Stack>

            </ProfileCompletionProvider>
          </MenuProvider>
        </GlobalState>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
