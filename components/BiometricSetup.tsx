import { supabase, supabaseRead } from "@/libs/supabase";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Fingerprint, KeyRound } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface BiometricSetupProps {
  currentUserEmail?: string; // Made optional to handle custom member sessions safely
}

export default function BiometricSetup({
  currentUserEmail,
}: BiometricSetupProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [credentialInput, setCredentialInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    checkHardwareSupport();
    loadCurrentSetting();
  }, [currentUserEmail]);

  const checkHardwareSupport = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setIsSupported(hasHardware && isEnrolled);
  };

  // Helper function to dynamically resolve the active email from either prop or custom storage
  const resolveActiveEmail = async (): Promise<string | null> => {
    if (currentUserEmail?.trim()) {
      return currentUserEmail.trim().toLowerCase();
    }
    try {
      const memberSessionRaw = await SecureStore.getItemAsync(
        "vitafit_member_session",
      );
      if (memberSessionRaw) {
        const memberData = JSON.parse(memberSessionRaw);
        if (memberData?.email) {
          return memberData.email.trim().toLowerCase();
        }
      }
    } catch (e) {
      console.warn("Failed parsing local member data:", e);
    }
    return null;
  };

  const loadCurrentSetting = async () => {
    try {
      const activeEmail = await resolveActiveEmail();
      if (!activeEmail) {
        setIsEnabled(false);
        return;
      }

      const savedStatus = await SecureStore.getItemAsync("biometrics_enabled");
      const savedEmail = await SecureStore.getItemAsync("biometric_email");

      if (savedStatus === "true" && savedEmail === activeEmail) {
        setIsEnabled(true);
      } else {
        setIsEnabled(false);
      }
    } catch {
      setIsEnabled(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    if (!isSupported) {
      Alert.alert(
        "Biometrics Unavailable",
        "Device hardware profile missing or unconfigured.",
      );
      return;
    }
    if (value) {
      setModalVisible(true);
    } else {
      await disableBiometrics();
    }
  };

  const disableBiometrics = async () => {
    try {
      await SecureStore.deleteItemAsync("biometrics_enabled");
      await SecureStore.deleteItemAsync("biometric_email");
      await SecureStore.deleteItemAsync("biometric_secret");
      setIsEnabled(false);
      Alert.alert("Disabled", "Biometric verification cleared.");
    } catch {
      Alert.alert("Error", "Failed to clear hardware storage keys.");
    }
  };

  const handleActivateBiometrics = async () => {
    if (!credentialInput.trim()) {
      Alert.alert(
        "Required",
        "Please provide your account password or member code.",
      );
      return;
    }

    setVerifying(true);
    const cleanSecret = credentialInput.trim();
    let isValidCredential = false;

    try {
      const sanitizedEmail = await resolveActiveEmail();
      if (!sanitizedEmail) {
        Alert.alert(
          "Error",
          "Could not locate active profile email context session.",
        );
        setVerifying(false);
        return;
      }

      // PATH 1: Check standard Supabase Auth (Staff/Admin accounts)
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password: cleanSecret,
        });

      if (!authError && authData.user) {
        isValidCredential = true;
      } else {
        // PATH 2: Fallback lookup matching custom Member Codes
        const { data: member } = await supabaseRead
          .from("members")
          .select("id")
          .eq("email", sanitizedEmail)
          .eq("member_code", cleanSecret.toUpperCase())
          .maybeSingle();

        if (member) isValidCredential = true;
      }

      if (!isValidCredential) {
        Alert.alert(
          "Verification Failed",
          "Credentials do not match our system security parameters.",
        );
        setVerifying(false);
        return;
      }

      // Prompt hardware biometric authentication check block
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage:
          "Confirm biometric credentials to secure access parameters",
        fallbackLabel: "Use Device Passcode",
      });

      if (biometricResult.success) {
        await SecureStore.setItemAsync("biometrics_enabled", "true");
        await SecureStore.setItemAsync("biometric_email", sanitizedEmail);
        await SecureStore.setItemAsync("biometric_secret", cleanSecret);

        setIsEnabled(true);
        setModalVisible(false);
        setCredentialInput("");
        Alert.alert("Success", "Biometric identity verification active!");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message ||
          "An unexpected error occurred during security provisioning.",
      );
    } finally {
      setVerifying(false);
    }
  };

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
            Unlock via Face ID or Fingerprint hardware scans
          </Text>
        </View>
      </View>

      <Switch
        value={isEnabled}
        onValueChange={handleToggle}
        trackColor={{ false: "#1f2937", true: "#2563eb" }}
        thumbColor={isEnabled ? "#ffffff" : "#9ca3af"}
        ios_backgroundColor="#1f2937"
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <KeyRound size={28} color="#3b82f6" />
              <Text style={styles.modalTitle}>Confirm Access Keys</Text>
              <Text style={styles.modalSubtitle}>
                Enter your staff account password or gym member code to securely
                activate biometric authentication.
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Password or Member Code"
              placeholderTextColor="#4b5563"
              secureTextEntry
              value={credentialInput}
              onChangeText={setCredentialInput}
              autoCapitalize="none"
              editable={!verifying}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => {
                  setModalVisible(false);
                  setCredentialInput("");
                }}
                disabled={verifying}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnConfirm]}
                onPress={handleActivateBiometrics}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.btnConfirmText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Global Automated Processing Bypass Hook
export async function tryBiometricAutoLogin(
  onSuccess: () => Promise<void>,
): Promise<boolean> {
  try {
    const isEnabled = await SecureStore.getItemAsync("biometrics_enabled");
    const cachedEmail = await SecureStore.getItemAsync("biometric_email");
    const cachedSecret = await SecureStore.getItemAsync("biometric_secret");

    if (isEnabled !== "true" || !cachedEmail || !cachedSecret) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Sign in to VitaFit Portal",
    });

    if (!result.success) return false;

    // PATH 1: Replay Staff matching authentication rules
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: cachedEmail,
        password: cachedSecret,
      });

    if (!authError && authData.user) {
      await onSuccess();
      return true;
    }

    // PATH 2: Replay Gym Client Member validation checks
    const { data: member } = await supabaseRead
      .from("members")
      .select("id, email, full_name, member_code, status")
      .eq("email", cachedEmail)
      .eq("member_code", cachedSecret.toUpperCase())
      .maybeSingle();

    if (member && member.status === "active") {
      await SecureStore.setItemAsync(
        "vitafit_member_session",
        JSON.stringify(member),
      );
      await onSuccess();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 16,
    marginBottom: 16,
    width: "100%",
  },
  leftRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  iconWrapper: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    padding: 10,
    borderRadius: 10,
  },
  textContainer: { flex: 1, gap: 2 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  subtitle: { color: "#6b7280", fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 24,
    width: "100%",
    maxWidth: 340,
    gap: 20,
  },
  modalHeader: { alignItems: "center", gap: 8 },
  modalTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  modalSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  input: {
    backgroundColor: "#030712",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    color: "#ffffff",
    padding: 14,
    fontSize: 15,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: { backgroundColor: "#1f2937" },
  btnCancelText: { color: "#9ca3af", fontWeight: "600" },
  btnConfirm: { backgroundColor: "#2563eb" },
  btnConfirmText: { color: "#ffffff", fontWeight: "600" },
});
