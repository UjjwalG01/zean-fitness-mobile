// components/HeaderLogoutButton.tsx
import { useDatabase } from "@/contexts/DatabaseContext";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native"; // 🚀 FIX 1: Only import icons from lucide
import React from "react";
// 🚀 FIX 2: Imported View from "react-native"
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function HeaderLogoutButton() {
  const { clearMemberSession } = useDatabase();
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
            // 1. Clear member session from SecureStore and DatabaseContext
            await clearMemberSession();

            // 2. Optional: Run custom auth hook cleanup if present
            if (logout) {
              await logout().catch(() => {});
            }

            // 3. Navigate directly to login
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
    <View style={styles.actionBtn}>
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <LogOut size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Terminate Session (Sign Out)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    width: "100%",
    marginBottom: 16,
  },
  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1f2937",
    width: "100%", // 🚀 FIX 3: Stretches full-width like standard form/card buttons
    padding: 14,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "bold",
    fontSize: 14,
  },
});
