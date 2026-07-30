// app/(client)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { HeaderLogoutButton } from "../../components/HeaderLogoutButton";

export default function ClientLayout() {
  return (
    <Stack
      screenOptions={{
        // Global header styling for all client screens
        headerStyle: { backgroundColor: "#111827" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "bold" },

        // Global background color for content area
        contentStyle: { backgroundColor: "#030712" },

        // Flat UI styling
        headerShadowVisible: false,

        // 🚀 FIX 1: Pass component reference directly to prevent header re-render flickers
        headerRight: HeaderLogoutButton,
      }}
    >
      {/* Profile Dashboard (app/(client)/index.tsx) */}
      <Stack.Screen
        name="index"
        options={{
          title: "Dashboard",
        }}
      />

      {/* Activity & Billing History (app/(client)/activities.tsx) */}
      <Stack.Screen
        name="activities"
        options={{
          title: "Activity & Billing History",
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}
