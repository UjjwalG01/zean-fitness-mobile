// app/(auth)/login.tsx
import { useFocusEffect, useRouter } from "expo-router";
import {
  Building2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Mail,
  RefreshCw,
  Shield,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useDatabase } from "../../contexts/DatabaseContext";
import { useAuth } from "../../hooks/useAuth";

import { MemberBiometricService } from "@/services/memberBiometricService";

export default function LoginScreen() {
  const router = useRouter();
  const { config, resetProperty, supabase, supabaseRead, setMemberSession } =
    useDatabase();
  const { refetchSession } = useAuth();
  const isAuthenticatingRef = useRef(false);
  const isMountedRef = useRef(true);

  const [email, setEmail] = useState("");
  const [passwordOrCode, setPasswordOrCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureMode, setSecureMode] = useState(true);

  const propertyName = config?.propertyName || "Default Property";
  const [hasBiometricRecord, setHasBiometricRecord] = useState(false);
  const [hasPromptedBio, setHasPromptedBio] = useState(false);

  // Field-level error state
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Email format checker regex
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Form input validation rules
  const validateInputs = (): boolean => {
    let valid = true;
    setEmailError("");
    setPasswordError("");

    const trimmedEmail = email.trim();
    const trimmedPassword = passwordOrCode.trim();

    // Email Validation
    if (!trimmedEmail) {
      setEmailError("Email address is required.");
      valid = false;
    } else if (!isValidEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    // Password / Security Key Validation
    if (!trimmedPassword) {
      setPasswordError("Security key or password is required.");
      valid = false;
    } else if (trimmedPassword.length < 4) {
      setPasswordError("Security key must be at least 4 characters.");
      valid = false;
    }

    if (!valid) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fix the highlighted errors before submitting.",
      });
    }

    return valid;
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function checkAndTriggerBiometrics() {
        // Prevent triggering if Supabase isn't ready or if already prompted
        if (!supabase || hasPromptedBio || isAuthenticatingRef.current) return;
        try {
          const isEnabled =
            await MemberBiometricService.isMemberBiometricsEnabled();
          if (!isMounted) return;

          if (isEnabled) {
            setHasBiometricRecord(true);
            await executeBiometricBypass();
          } else {
            setHasBiometricRecord(false);
          }
        } catch (err) {
          console.warn("Error reading biometric configuration keys:", err);
        }
      }

      checkAndTriggerBiometrics();
      return () => {
        isMounted = false;
      };
    }, [supabase, hasPromptedBio]),
  );

  const executeBiometricBypass = async () => {
    if (!supabase || isAuthenticatingRef.current) return;

    isAuthenticatingRef.current = true;
    setHasPromptedBio(true);

    try {
      // Step 1: Prompt fingerprint & exchange stored refresh token with Supabase
      const result =
        await MemberBiometricService.authenticateMemberWithBiometrics(supabase);

      if (!isMountedRef.current) return;

      if (result.success) {
        // Step 2: Refetch session context if needed & route to client dashboard
        if (refetchSession) await refetchSession();
        router.replace("/(client)");
      } else {
        // Handle actual auth errors (e.g., token expired on server)
        // Ignores user cancels ("Biometric prompt cancelled or failed")
        if (
          result.error &&
          result.error !== "Biometric prompt cancelled or failed"
        ) {
          Alert.alert("Biometric Auth Failed", result.error);
        }
      }
    } catch (err) {
      console.error("[Login] Biometric bypass exception:", err);
    } finally {
      isAuthenticatingRef.current = false;
    }
  };

  const handleManualBiometricPress = () => {
    // 1. Reset the guard so manual taps always trigger the OS prompt
    setHasPromptedBio(false);

    // 2. Trigger the token-based biometric exchange
    executeBiometricBypass();
  };

  // Dual-path authentication logic
  const handleStandardLogin = async () => {
    if (!validateInputs()) return;
    console.log("1. Inputs validated");

    if (!supabase) {
      Toast.show({
        type: "error",
        text1: "Connection Error",
        text2: "No active database connection found for this property.",
      });
      return;
    }

    setLoading(true);
    const sanitizedEmail = email.trim().toLowerCase();
    const secretKeyInput = passwordOrCode.trim();

    try {
      const readClient = supabaseRead || supabase;

      // ========================================== //
      // PATH 1: STAFF AUTHENTICATION (app_users)   //
      // ========================================== //
      console.log("2. Attempting Supabase Auth Sign In...");
      const authPromise = supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: secretKeyInput,
      });

      if (!isMountedRef.current) return; // Guard against unmounted state

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Auth request timed out. Check network or DB URL configuration.",
              ),
            ),
          5000,
        ),
      );

      const { data: authData, error: authError } = (await Promise.race([
        authPromise,
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      if (authData?.session) {
        // Dismiss backstack to prevent back-button navigation back to login
        if (router.canDismiss()) {
          router.dismissAll();
        }
        router.replace("/(staff)");
      }

      if (authError) {
        console.log(
          "❌ Auth Error Object:",
          JSON.stringify(authError, null, 2),
        );
      } else {
        console.log("✅ Auth Success Data:", authData);
      }

      if (!authError && authData.user) {
        console.log("3. Staff match found. Fetching app_users...");
        const { data: staffUser } = await readClient
          .from("app_users")
          .select("id, email, role, full_name, status")
          .eq("email", sanitizedEmail)
          .maybeSingle();

        console.log("4. Refetching session...");

        if (staffUser && staffUser.status === "inactive") {
          await supabase.auth.signOut();
          Toast.show({
            type: "error",
            text1: "Access Denied",
            text2: !staffUser
              ? "Staff profile record not found."
              : "Your staff account is currently inactive.",
          });
          setLoading(false);
          return;
        }

        if (refetchSession) await refetchSession();

        Toast.show({
          type: "success",
          text1: "Staff Portal Access",
          text2: `Welcome back, ${staffUser?.full_name || "Staff Member"}!`,
        });

        console.log("5. Redirecting to /(staff)...");
        router.replace("/(staff)");
        return;
      }

      // ==========================================
      // PATH 2: CLIENT / MEMBER AUTHENTICATION (members)
      // ==========================================
      console.log("3b. Checking member database records...");
      const { data: member, error: memberError } = await readClient
        .from("members")
        .select("id, email, member_code, status, full_name, outlet_id, tier")
        .eq("email", sanitizedEmail)
        .ilike("member_code", secretKeyInput)
        .maybeSingle();

      if (memberError) {
        throw new Error("Member lookup failed: " + memberError.message);
      }

      if (member) {
        if (member.status !== "active") {
          Toast.show({
            type: "error",
            text1: "Access Denied",
            text2: "Your membership account is currently inactive.",
          });
          setLoading(false);
          return;
        }

        console.log("4b. Member verified. Requesting custom JWT token...");

        // Extract credentials from property config
        const supabaseUrl = config?.supabaseUrl;
        const apiKey =
          config?.supabasePublishableKey || (config as any)?.supabaseAnonKey;

        if (!supabaseUrl || !apiKey) {
          throw new Error(
            "Property configuration is missing Supabase credentials.",
          );
        }

        // 🚀 FAIL-SAFE: 12-second timeout controller so app NEVER hangs forever
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        try {
          const functionUrl = `${supabaseUrl}/functions/v1/create-member-jwt`;

          const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              memberId: member.id,
              email: member.email,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const resData = await response.json();
          console.log("4c. Edge Function Response Status:", response.status);
          console.log("4d. Edge Function Response Data:", resData);

          if (!response.ok || !resData?.token) {
            throw new Error(
              resData?.error ||
                resData?.message ||
                `Function failed with status ${response.status}`,
            );
          }

          const token = resData.token;

          // Store member session and sync with DatabaseContext
          await setMemberSession({ ...member, token });

          if (refetchSession) await refetchSession();

          Toast.show({
            type: "success",
            text1: "Client Portal Access",
            text2: `Welcome back, ${member.full_name || "Member"}!`,
          });

          // REDIRECT TO CLIENT DASHBOARD
          router.replace("/(client)");
          return;
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === "AbortError") {
            throw new Error(
              "Edge function request timed out after 12s. Please check server logs.",
            );
          }
          throw fetchErr;
        }
      }

      // If neither staff nor member credentials match
      Toast.show({
        type: "error",
        text1: "Access Denied",
        text2: "No match found for those credentials in our security records.",
      });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Authentication Error",
        text2:
          err.message || "An unexpected system verification error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Re-configure property action with confirmation dialog
  const handleReconfigureProperty = () => {
    Alert.alert(
      "Re-configure Property?",
      `Are you sure you want to disconnect from "${propertyName}" and scan a new property QR code?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink & Scan",
          style: "destructive",
          onPress: async () => {
            await resetProperty();
            router.replace("/setup" as any);
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={styles.keyboardContainer} behavior={"padding"}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* 1. HEADER TITLE BLOCK */}
          <View style={styles.headerBlock}>
            <Shield size={44} color="#3b82f6" style={styles.logoIcon} />
            <Text style={styles.title}>Zean Fitness Portal</Text>
            <Text style={styles.subtitle}>
              Sign in with club credentials or your secure member access token
            </Text>
          </View>

          {/* 2. ACTIVE PROPERTY BADGE & RE-CONFIGURE BUTTON */}
          <View style={styles.propertyHeader}>
            <View style={styles.propertyBadge}>
              <Building2 size={18} color="#3b82f6" />
              <View style={styles.propertyTextContainer}>
                <Text style={styles.propertyLabel}>Active Property</Text>
                <Text style={styles.propertyName} numberOfLines={1}>
                  {propertyName}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.reconfigureButton}
              onPress={handleReconfigureProperty}
              activeOpacity={0.7}
            >
              <RefreshCw size={14} color="#9ca3af" />
              <Text style={styles.reconfigureText}>Switch</Text>
            </TouchableOpacity>
          </View>

          {/* 3. LOGIN FORM */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <View
                style={[
                  styles.inputWrapper,
                  emailError ? styles.inputErrorBorder : null,
                ]}
              >
                <Mail
                  size={18}
                  color={emailError ? "#ef4444" : "#6b7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#4b5563"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}
            </View>

            {/* Password / Secure Key Input */}
            <View style={styles.inputContainer}>
              <View
                style={[
                  styles.inputWrapper,
                  passwordError ? styles.inputErrorBorder : null,
                ]}
              >
                <KeyRound
                  size={18}
                  color={passwordError ? "#ef4444" : "#6b7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInputPadding]}
                  placeholder="Security Key / Password"
                  placeholderTextColor="#4b5563"
                  value={passwordOrCode}
                  onChangeText={(text) => {
                    setPasswordOrCode(text);
                    if (passwordError) setPasswordError("");
                  }}
                  secureTextEntry={secureMode}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.suffixIconButton}
                  onPress={() => setSecureMode(!secureMode)}
                  activeOpacity={0.7}
                >
                  {secureMode ? (
                    <EyeOff size={20} color="#9ca3af" />
                  ) : (
                    <Eye size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleStandardLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.actionButtonText}>Verify Access</Text>
              )}
            </TouchableOpacity>

            {/* Biometric Button */}
            {hasBiometricRecord && (
              <TouchableOpacity
                style={[
                  styles.biometricTriggerRow,
                  isAuthenticatingRef.current && { opacity: 0.5 },
                ]}
                onPress={handleManualBiometricPress}
                activeOpacity={0.7}
                disabled={isAuthenticatingRef.current}
              >
                <Fingerprint size={18} color="#60a5fa" />
                <Text style={styles.biometricTriggerText}>
                  Sign In with Biometrics
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#030712",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#030712",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#030712",
  },
  propertyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginTop: 20,
    marginBottom: 16,
  },
  propertyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  propertyTextContainer: {
    flex: 1,
  },
  propertyLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  propertyName: {
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "700",
  },
  reconfigureButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1f2937",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  reconfigureText: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "600",
  },
  headerBlock: { alignItems: "center", marginBottom: 24 },
  logoIcon: { marginBottom: 12 },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "bold" },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  form: { gap: 16 },
  inputContainer: {
    marginBottom: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    position: "relative",
    paddingLeft: 14,
  },
  inputErrorBorder: {
    borderColor: "#ef4444",
    borderWidth: 1.5,
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  inputIcon: { marginRight: 4 },
  input: {
    flex: 1,
    color: "#ffffff",
    paddingVertical: 14,
    fontSize: 15,
  },
  passwordInputPadding: {
    paddingRight: 52,
  },
  actionButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  suffixIconButton: {
    position: "absolute",
    right: 0,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  actionButtonText: { color: "#ffffff", fontWeight: "bold", fontSize: 15 },
  biometricTriggerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.2)",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  biometricTriggerText: {
    color: "#60a5fa",
    fontWeight: "600",
    fontSize: 14,
  },
});
