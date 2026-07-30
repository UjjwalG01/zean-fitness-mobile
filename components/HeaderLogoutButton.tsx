// components/HeaderLogoutButton.tsx
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native";
import React from "react";
import { Alert, TouchableOpacity } from "react-native";

export function HeaderLogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch (error: any) {
            Alert.alert(
              "Logout Error",
              error.message || "Failed to gracefully clear session.",
            );
          }
        },
      },
    ]);
  };

  return (
    <TouchableOpacity onPress={handleLogout} style={{ padding: 8 }}>
      <LogOut size={20} color="#ef4444" />
    </TouchableOpacity>
  );
}
