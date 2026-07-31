import { useDatabase } from "@/contexts/DatabaseContext";
import { MemberBiometricService } from "@/services/memberBiometricService";
import { Fingerprint } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

/**
 * Promise wrapper that rejects if the task takes longer than timeoutMs (default 7 seconds)
 */
const withTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number = 7000,
  errorMessage: string = "Biometric operation timed out. Please try again.",
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export default function BiometricSetup() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isMountedRef = useRef(true);
  const { supabase } = useDatabase();

  useEffect(() => {
    isMountedRef.current = true;
    initializeBiometricStatus();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const initializeBiometricStatus = async () => {
    try {
      const hardwareAvailable =
        await MemberBiometricService.isHardwareAvailable();
      if (isMountedRef.current) setIsSupported(hardwareAvailable);

      if (hardwareAvailable) {
        const biometricsEnabled =
          await MemberBiometricService.isMemberBiometricsEnabled();
        if (isMountedRef.current) setIsEnabled(biometricsEnabled);
      }
    } catch (error) {
      console.error("[BiometricSetup] Failed to initialize status:", error);
      if (isMountedRef.current) setIsSupported(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    if (!isSupported) {
      Alert.alert(
        "Biometrics Unavailable",
        "Device hardware is missing or biometrics are not enrolled in settings.",
      );
      return;
    }

    if (!supabase) {
      Alert.alert("System Error", "Database client is not connected.");
      return;
    }

    setIsProcessing(true);

    try {
      if (value) {
        // TURN ON: Grab session and authenticate via withTimeout wrapper
        const enableProcess = async () => {
          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session?.refresh_token) {
            throw new Error(
              "Could not verify your active secure session. Please log out and back in.",
            );
          }

          const email = data.session.user?.email || "unknown";
          const refreshToken = data.session.refresh_token;

          return await MemberBiometricService.enableMemberBiometrics(
            refreshToken,
            email,
          );
        };

        const success = await withTimeout(
          enableProcess(),
          7000,
          "Biometric setup timed out. OS prompt or secure storage failed to respond.",
        );

        if (success) {
          if (isMountedRef.current) setIsEnabled(true);
          Alert.alert("Success", "Biometric login is now active!");
        } else {
          // User cancelled the prompt or it failed
          if (isMountedRef.current) setIsEnabled(false);
        }
      } else {
        // TURN OFF: Wipe stored token via withTimeout wrapper
        await withTimeout(
          MemberBiometricService.disableMemberBiometrics(),
          7000,
          "Disabling biometrics timed out. Secure storage failed to respond.",
        );

        if (isMountedRef.current) setIsEnabled(false);
        Alert.alert("Disabled", "Biometric login has been turned off.");
      }
    } catch (err: any) {
      if (isMountedRef.current) setIsEnabled(false);
      Alert.alert(
        "Biometric Error",
        err?.message || "An unexpected error occurred while updating settings.",
      );
    } finally {
      // Unconditionally stop processing spinner
      setIsProcessing(false);
    }
  };

  // If the device doesn't support FaceID/TouchID, don't render the option at all
  if (!isSupported) return null;

  return (
    <View style={styles.card}>
      <View style={styles.leftRow}>
        <View style={styles.iconWrapper}>
          <Fingerprint size={22} color="#3b82f6" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Biometric Identity Login</Text>
          <Text style={styles.subtitle}>
            Unlock securely with Face ID or Fingerprint
          </Text>
        </View>
      </View>

      {isProcessing ? (
        <ActivityIndicator color="#2563eb" size="small" style={styles.loader} />
      ) : (
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: "#1f2937", true: "#2563eb" }}
          thumbColor={isEnabled ? "#ffffff" : "#9ca3af"}
          ios_backgroundColor="#1f2937"
          disabled={isProcessing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginVertical: 8,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: { flex: 1 },
  title: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  subtitle: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  loader: {
    marginRight: 8,
  },
});
