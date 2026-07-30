// app/index.tsx
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useDatabase } from "../contexts/DatabaseContext";

export default function () {
  // 🚀 FIX: Pure structural entrypoint. ALL redirection handled by _layout.tsx guard.
  // This file should ONLY display a loading screen, never perform navigation.
  const { isLoading } = useDatabase();

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
});
