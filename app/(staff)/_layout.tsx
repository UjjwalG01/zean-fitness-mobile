// app/(staff)/_layout.tsx
import { Tabs } from "expo-router";
import { BarChart3, Home, Receipt, ScanLine, Users } from "lucide-react-native";
import React from "react";
import { HeaderLogoutButton } from "../../components/HeaderLogoutButton";

export default function StaffLayout() {
  return (
    <Tabs
      screenOptions={{
        // Bottom Tab Bar Styling
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#1f2937",
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },

        // Header Styling for all Staff screens
        headerStyle: {
          backgroundColor: "#111827",
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },
        headerShadowVisible: false,

        // 🚀 FIX: Direct component reference to prevent header button flickering
        headerRight: HeaderLogoutButton,

        // Ensure background color behind tab content matches dark theme
        sceneStyle: {
          backgroundColor: "#030712",
        },
      }}
    >
      {/* 1. Dashboard Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />

      {/* 2. Attendance Scanner Tab */}
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarLabel: "Attendance",
          tabBarIcon: ({ color, size }) => (
            <ScanLine size={size} color={color} />
          ),
        }}
      />

      {/* 3. Members Directory Tab */}
      <Tabs.Screen
        name="members"
        options={{
          title: "Members",
          tabBarLabel: "Members",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />

      {/* 4. POS & Transactions Tab */}
      <Tabs.Screen
        name="ledger"
        options={{
          title: "Transactions Ledger",
          tabBarLabel: "Transactions",
          tabBarIcon: ({ color, size }) => (
            <Receipt size={size} color={color} />
          ),
        }}
      />

      {/* 5. Analytics & Reports Tab */}
      <Tabs.Screen
        name="reports"
        options={{
          title: "Analytics Reports",
          tabBarLabel: "Reports",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
