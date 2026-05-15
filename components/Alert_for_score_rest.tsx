import React, { useEffect, useRef } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Animated,
    Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AlertType = "info" | "success" | "warning" | "error";

type AppAlertButton = {
    label: string;
    onPress: () => void;
    style?: "default" | "cancel" | "destructive";
};

type AppAlertProps = {
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    buttons?: AppAlertButton[];
    onDismiss?: () => void;
};

const TYPE_CONFIG: Record<AlertType, { icon: string; color: string; bg: string }> = {
    info: { icon: "information-circle", color: "#1976d2", bg: "#e3f2fd" },
    success: { icon: "checkmark-circle", color: "#2e7d32", bg: "#e8f5e9" },
    warning: { icon: "warning", color: "#f57c00", bg: "#fff3e0" },
    error: { icon: "close-circle", color: "#c62828", bg: "#ffebee" },
};

/* ── Spinner ── */
function Spinner({ color }: { color: string }) {
    const rotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
            {/* Outer ring */}
            <View style={[spinnerStyles.ring, { borderColor: color + "30" }]}>
                {/* Arc */}
                <View style={[spinnerStyles.arc, { borderTopColor: color }]} />
            </View>
        </Animated.View>
    );
}

const spinnerStyles = StyleSheet.create({
    ring: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    arc: {
        position: "absolute",
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: "transparent",
        top: -4,
        left: -4,
    },
});

/* ── Main Component ── */
export default function Alert_for_score_rest({
    visible,
    type = "info",
    title,
    message,
    buttons,
    onDismiss,
}: AppAlertProps) {
    const { icon, color, bg } = TYPE_CONFIG[type];

    const isResetting = title.toLowerCase().includes("resetting");

    const resolvedButtons: AppAlertButton[] =
        buttons && buttons.length > 0
            ? buttons
            : [{ label: "OK", onPress: onDismiss ?? (() => { }), style: "default" }];

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={isResetting ? undefined : onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>

                    {/* Icon badge OR Spinner */}
                    <View style={[styles.iconWrap, { backgroundColor: bg }]}>
                        {isResetting ? (
                            <Spinner color={color} />
                        ) : (
                            <Ionicons name={icon as any} size={32} color={color} />
                        )}
                    </View>

                    {/* Text */}
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    {/* Divider — hidden while resetting */}
                    {!isResetting && <View style={styles.divider} />}

                    {/* Buttons — hidden while resetting */}
                    {!isResetting && (
                        <View
                            style={[
                                styles.buttonRow,
                                resolvedButtons.length === 1 && { justifyContent: "center" },
                            ]}
                        >
                            {resolvedButtons.map((btn, i) => {
                                const isCancel = btn.style === "cancel";
                                const isDestructive = btn.style === "destructive";
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            styles.button,
                                            isCancel && styles.buttonCancel,
                                            isDestructive && styles.buttonDestructive,
                                            !isCancel && !isDestructive && { backgroundColor: color },
                                            resolvedButtons.length === 1 && { paddingHorizontal: 40 },
                                        ]}
                                        onPress={btn.onPress}
                                        activeOpacity={0.8}
                                    >
                                        <Text
                                            style={[
                                                styles.buttonText,
                                                isCancel && styles.buttonTextCancel,
                                            ]}
                                        >
                                            {btn.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 30,
        width: "100%",
    },
    card: {
        width: 315,
        backgroundColor: "#fff",
        borderRadius: 18,
        paddingTop: 20,
        paddingBottom: 15,
        paddingHorizontal: 15,
        alignItems: "center",
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
            android: { elevation: 12 },
            web: { boxShadow: "0 8px 32px rgba(0,0,0,0.18)" },
        }),
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: "#555",
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 20,
    },
    divider: {
        width: "100%",
        height: 1,
        backgroundColor: "#f0f0f0",
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 10,
        width: "100%",
    },
    button: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        alignItems: "center",
    },
    buttonCancel: { backgroundColor: "#f0f0f0" },
    buttonDestructive: { backgroundColor: "#c62828" },
    buttonText: { fontSize: 15, fontWeight: "600", color: "#fff" },
    buttonTextCancel: { color: "#444" },
});