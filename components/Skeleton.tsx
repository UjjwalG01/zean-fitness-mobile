import React, { useEffect, useRef } from "react";
// 🚀 FIXED: Added DimensionValue to the import statement
import { Animated, DimensionValue, StyleSheet, ViewStyle } from "react-native";

interface SkeletonProps {
  width: DimensionValue; // 🚀 FIXED: Replaced 'number | string'
  height: DimensionValue; // 🚀 FIXED: Replaced 'number | string'
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 🚀 Creates an infinite looping fade-in/fade-out pulse effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity: pulseAnim },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#1f2937", // Matches your existing border/dark UI panel color
  },
});
