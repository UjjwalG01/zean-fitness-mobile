// app/_layout.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { clearPropertyConfig } from "@/services/configStorage";
import { DatabaseProvider, useDatabase } from "../contexts/DatabaseContext";
import { OutletProvider } from "../contexts/OutletContext";

const queryClient = new QueryClient();

function AppGuardLayout() {
  // 1. Single Source of Truth from DatabaseContext
  const {
    config,
    supabase,
    user: dbUser,
    userRole: dbUserRole,
    isLoading, // Handles both DB initialization and session check
  } = useDatabase();

  const segments = useSegments();
  const router = useRouter();

  const activeUser = dbUser;
  const isConfigured = Boolean(config && supabase);
  const isAuthenticated = Boolean(activeUser);

  useEffect(() => {
    // ✋ DO NOT REDIRECT while initial DB or Session checks are active
    if (isLoading) return;

    const currentSegment = segments[0] as string | undefined;
    const inSetupGroup = currentSegment === "setup";
    const inAuthGroup = currentSegment === "(auth)";
    const inStaffGroup = currentSegment === "(staff)";
    const inClientGroup = currentSegment === "(client)";

    // LAYER 1: No Database Configured -> Send straight to QR Setup
    if (!isConfigured) {
      if (!inSetupGroup) {
        router.replace("/setup");
      }
      return;
    }

    // LAYER 2: Unauthenticated User -> Direct to Auth
    if (!isAuthenticated) {
      if (!inAuthGroup && !inSetupGroup) {
        router.replace("/(auth)/login");
      }
      return;
    }

    // Determine staff status safely
    const isCustomMember = Boolean((activeUser as any)?.isCustomMember);
    const effectiveRole = String(dbUserRole || "")
      .trim()
      .toLowerCase();
    const isStaff =
      !isCustomMember &&
      (effectiveRole === "staff" ||
        ["admin", "manager", "staff", "superadmin", "owner"].includes(
          effectiveRole,
        ));

    const targetDashboard = isStaff ? "/(staff)" : "/(client)";

    // LAYER 3: Authenticated user on /setup screen -> Direct to Dashboard
    if (inSetupGroup) {
      router.replace(targetDashboard);
      return;
    }

    // LAYER 4: Prevent authenticated users from staying on Login screens
    if (inAuthGroup) {
      router.replace(targetDashboard);
      return;
    }

    // LAYER 5: Root path catch "/"
    if (!currentSegment) {
      router.replace(targetDashboard);
      return;
    }

    // 🚀 FIX LAYER 6: Add explicit guard to prevent redundant cross-boundary redirects
    // Only redirect if user is actually on the WRONG dashboard
    if (isStaff && inClientGroup) {
      // Verify they're not already being redirected
      if (segments.length <= 1 || segments[1] !== "index") {
        router.replace("/(staff)");
      }
    } else if (!isStaff && inStaffGroup) {
      if (segments.length <= 1 || segments[1] !== "index") {
        router.replace("/(client)");
      }
    }
  }, [
    isConfigured,
    isAuthenticated,
    activeUser,
    dbUserRole,
    isLoading,
    segments,
    router, // 🚀 FIX: Add router to dependencies for stability
  ]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Button
          title="Clear Saved Property Data"
          onPress={async () => {
            await clearPropertyConfig();
            Alert.alert("Cleared", "App storage cleared. Restarting app...");
          }}
        />
        <Text style={styles.text}>Establishing Secure Link...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#030712" }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="setup" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <DatabaseProvider>
          <OutletProvider>
            <AppGuardLayout />
            <Toast />
          </OutletProvider>
        </DatabaseProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  text: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});
