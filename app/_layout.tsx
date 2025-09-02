import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { useEffect } from "react";
//import { GlobalState } from "@/context/auth";
import { Platform, TouchableOpacity, View, Text } from "react-native";
import { AuthProvider } from "@/context/auth";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { UserName } from "@/components/userName";
 //const { user, isLoading } = useAuth();
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShadowVisible: true,
            animation: "flip",
            headerTitle: "",
            headerStyle: {},
            headerTitleStyle: { color: "#099750c7", fontSize: 18, fontWeight: "700" },
            statusBarBackgroundColor: "#099750c7",
            headerTintColor: "#099750c7",
            navigationBarColor: '#e6f7e6',
            headerBackTitle: "yccxxyy",
            title: "tttt",
            headerRight: () => (
              <View>
                <View style={{ position: "relative", right: Platform.OS === 'ios' ? 30 : 0, alignItems: "center", width: Platform.OS === 'ios' ? "100%" : "100%", }}>
                  <TouchableOpacity>
                    <></>
                  </TouchableOpacity>
                </View>
              </View>
            ),
          }}
        >
          <Stack.Screen name="index" options={{ headerTitle: "", headerShown: false, navigationBarColor: '#e6f7e6', }} />
          <Stack.Screen name="VerificationScreen" options={{ headerTitle: "", headerShown: false, navigationBarColor: '#069245d8' }} />
          <Stack.Screen name="register" options={{ headerTitle: "", headerShown: false, navigationBarColor: '#069245d8' }} />
          <Stack.Screen name="login" options={{ headerTitle: "Login", headerShown: false, navigationBarHidden: true }} />

          <Stack.Screen name="chat/chat_room"
            options={{
              headerTitle: "Chat Room", navigationBarColor: '#fff',headerShown: false,
              headerRight: () => (
                <TouchableOpacity>
                  <View>
                    <></>
                  </View>
                </TouchableOpacity>
              ),

            }} />

          <Stack.Screen name="chat/chat_list"
            options={{
              headerTitle: "", 
              navigationBarColor: '#fff',
              headerShown: Platform.OS === "web"? false : true,
              headerLeft: () => (
                <View style={{ flexDirection: "row" }}>
                  <TouchableOpacity
                    style={{ paddingRight: 5, flexDirection: "row" }}
                  >
                    <View>
                      <Text
                        style={{ fontSize: 18, color: "#099750ff", fontWeight: "800" }}
                      >
                        VR-Druaght
                      </Text>
                      <Text
                        style={{ fontSize: 13, color: "#099750ff", fontWeight: "600" }}
                      >
                        Association
                      </Text>
                    </View>
                  </TouchableOpacity></View>

              ),
              headerRight: () => (
                <View>
                  
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center",}}>
                  <AntDesign name="link" size={20} color="#666" />
                  <UserName />
                </TouchableOpacity>
               
                </View>
              ),

            }} />
          {/*

        const user:any = auth.currentUser;
   let userName =user.displayName = user.displayName || 'Anonymous';

          <Stack.Screen
            name="medications/add"
            options={{
              headerShown: false,
              headerBackTitle: "",
              title: "",
            }}
          />
  
          <Stack.Screen
            name="refills/index"
            options={{
              headerShown: false,
              headerBackTitle: "",
              title: "",
            }}
          />
          <Stack.Screen
            name="calendar/index"
            options={{
              headerShown: false,
              headerBackTitle: "",
              title: "",
            }}
          />
          <Stack.Screen
            name="history/index"
            options={{
              headerShown: false,
              headerBackTitle: "",
              title: "",
            }}
          /> */}
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
