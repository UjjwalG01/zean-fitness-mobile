// app/(client)/_layout.tsx
import { MemberAcitvity } from "@/components/MemberActivity";
import { Stack } from "expo-router";
import React from "react";

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
      }}
    >
      {/* Profile Dashboard (app/(client)/index.tsx) */}
      <Stack.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerRight: MemberAcitvity,
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
