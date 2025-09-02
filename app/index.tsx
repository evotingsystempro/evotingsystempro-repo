import React, { useCallback, useContext, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { ThemedView } from "@/components/ThemedView";

export default function IndexScreen() {
    //const { user, signIn } = useContext(GlobalContext);
    const { user, isLoading, signIn } = useAuth();
    const router = useRouter();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        // Fade In + Scale In
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 15,
                friction: 1,
                useNativeDriver: true,
            }),
        ]).start();

        const timer = setTimeout(() => {
            // Fade Out before navigating
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    if (!isLoading) {
                       if (!user) {
                        router.replace("./login");
                    } else {
                        router.push("/chat/chat_list");
                    }
                    }

                    
                }
            });
        }, 1200);

        return () => clearTimeout(timer);
    }, [user]);

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
                <Ionicons name="shield-checkmark-sharp" size={60} color="white" />
                <Text style={styles.appName}>Please wait..</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "rgb(9, 151, 80)",
        alignItems: "center",
        justifyContent: "center",
    },
    iconContainer: {
        alignItems: "center",
    },
    appName: {
        color: "white",
        fontSize: 20,
        fontWeight: "bold",
        marginTop: 20,
        letterSpacing: 1,
    },
});
