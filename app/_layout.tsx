import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as Updates from "expo-updates";
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
  const {
    config,
    supabase,
    user: dbUser,
    userRole: dbUserRole,
    isLoading,
  } = useDatabase();

  const segments = useSegments();
  const router = useRouter();

  const isConfigured = Boolean(config && supabase);
  const isAuthenticated = Boolean(dbUser);

  // Compute staff status safely
  const isCustomMember = Boolean((dbUser as any)?.isCustomMember);
  const effectiveRole = String(dbUserRole || "")
    .trim()
    .toLowerCase();

  // 🚀 FIX 1: Explicitly check that role is resolved before classifying as non-staff
  const isRoleResolved = dbUserRole !== undefined && dbUserRole !== null;
  const isStaff =
    !isCustomMember &&
    ["admin", "manager", "staff", "superadmin", "owner"].includes(
      effectiveRole,
    );

  useEffect(() => {
    // ✋ Block navigation until DB, Session, and User Role are fully resolved
    if (isLoading || (isAuthenticated && !isRoleResolved)) return;

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

    const targetDashboard = isStaff ? "/(staff)" : "/(client)";

    // LAYER 3 & 4: Authenticated user on Setup, Auth, or Root path -> Send to appropriate Dashboard
    if (inSetupGroup || inAuthGroup || !currentSegment) {
      router.replace(targetDashboard);
      return;
    }

    // 🚀 FIX 2: Clean cross-boundary routing without redundant nested condition checks
    if (isStaff && inClientGroup) {
      router.replace("/(staff)");
    } else if (!isStaff && inStaffGroup) {
      router.replace("/(client)");
    }
  }, [
    isLoading,
    isConfigured,
    isAuthenticated,
    isRoleResolved,
    isStaff,
    // Joined string key avoids unnecessary effect triggers on array reference changes
    segments.join("/"),
  ]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Button
          title="Clear Saved Property Data"
          onPress={async () => {
            await clearPropertyConfig();
            Alert.alert("Cleared", "App storage cleared. Reloading app...", [
              {
                text: "OK",
                onPress: async () => {
                  try {
                    // 🚀 FIX 4: Hard reload app after clearing config
                    await Updates.reloadAsync();
                  } catch {
                    // Fallback to setup navigation if updates SDK isn't available in dev
                    router.replace("/setup");
                  }
                },
              },
            ]);
          }}
        />
        <Text style={styles.text}>Establishing Secure Link...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#030712" }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
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
