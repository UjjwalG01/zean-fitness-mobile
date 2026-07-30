// app/setup.tsx
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";

import { useDatabase } from "../contexts/DatabaseContext";
import { PropertyConfig } from "../services/configStorage";

export default function SetupScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const { setupProperty } = useDatabase();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          Camera access is required to pair with your property location.
        </Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);

    try {
      const payload: PropertyConfig = JSON.parse(data);
      if (!payload.supabaseUrl || !payload.supabasePublishableKey) {
        throw new Error("Invalid setup QR format");
      }

      // 1. Clear all in-memory React Query cached data from old DB
      queryClient.clear();

      // 2. Clear old member session from SecureStore
      await SecureStore.deleteItemAsync("vitafit_member_session");

      // 3. Re-initialize Supabase client with new property credentials
      await setupProperty(payload);

      Alert.alert(
        "Property Switched",
        `Successfully connected to ${payload.propertyName || "New Property"}. Please log in with your credentials for this location.`,
        [
          {
            text: "Continue to Login",
            onPress: () => router.replace("/(auth)/login"),
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        "Scan Failed",
        "Unrecognized QR code. Please scan the official Property Setup QR Code.",
      );
      setScanning(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <Text style={styles.title}>Scan Property QR Code</Text>
        <Text style={styles.subtitle}>
          Point camera at the manager web portal QR
        </Text>
      </View>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarCodeScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
    top: 70,
    zIndex: 10,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  subtitle: { color: "#ccc", fontSize: 14, marginTop: 4, textAlign: "center" },
  text: {
    color: "#fff",
    textAlign: "center",
    marginHorizontal: 20,
    marginBottom: 20,
  },
});
