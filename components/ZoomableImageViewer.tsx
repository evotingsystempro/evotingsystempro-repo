import React from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import Modal from "react-native-modal";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withTiming,
} from "react-native-reanimated";
import {
  PinchGestureHandler,
  PanGestureHandler,
  PinchGestureHandlerGestureEvent,
  PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

type Props = {
  uri: string | null;
  onClose: () => void;
};

export default function ZoomableImageViewer({ uri, onClose }: Props) {
  if (!uri) return null;

  // --- Shared Values ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // --- Pinch Gesture (Zoom) ---
  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onActive: (event) => {
      scale.value = savedScale.value * event.scale;
    },
    onEnd: () => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      }
      if (scale.value > 4) {
        scale.value = withTiming(4);
        savedScale.value = 4;
      }
    },
  });

  // --- Pan Gesture (Drag) ---
  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: () => {
      // snap back smoothly when released
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    },
  });

  // --- Animated Style ---
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Modal
      isVisible={!!uri}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={1}
      backdropColor="#000"
      style={{ margin: 0 }}
      onBackdropPress={onClose}
    >
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close-circle" size={38} color="#fff" />
        </TouchableOpacity>

        {/* Gesture Handlers */}
        <PanGestureHandler onGestureEvent={panHandler}>
          <Animated.View>
            <PinchGestureHandler onGestureEvent={pinchHandler}>
              <Animated.Image
                source={{ uri }}
                resizeMode="contain"
                style={[styles.image, animatedStyle]}
              />
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.98)",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width,
    height,
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
  },
});
