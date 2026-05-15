import { Platform } from "react-native";
import { useMemo } from "react";

export function useWebInputStyle() {
    return useMemo(() => {
        if (Platform.OS !== "web") return {};

        return {
            outlineStyle: "none",
            outlineWidth: 0,
            boxShadow: "none",
            caretColor: "#111827",
        };
    }, []);
}
