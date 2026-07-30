// app/index.tsx
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useDatabase } from "../contexts/DatabaseContext";

export default function () {
  // Pure structural entrypoint. The layout guard handles all redirection.
  const router = useRouter();
  const { config, user, userRole, isLoading } = useDatabase();

  useEffect(() => {
    if (isLoading) return;

    // 1. No property database configured -> Setup QR Screen
    if (!config) {
      router.replace("/setup");
      return;
    }

    // 2. Database configured but user not logged in -> Auth Screen
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    // 3. User authenticated -> Route by role
    if (userRole === "staff") {
      router.replace("/(staff)");
    } else {
      router.replace("/(client)");
    }
  }, [isLoading, config, user, userRole]);

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
