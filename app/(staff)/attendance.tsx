import { useDatabase } from "@/contexts/DatabaseContext";
import { getSystemTimestamp, getSystemTodayStr } from "@/libs/timeUtils";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Keyboard, QrCode, RefreshCw, ScanLine } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AttendanceScanner() {
  const { supabase } = useDatabase();

  const [memberId, setMemberId] = useState("");
  const [processing, setProcessing] = useState(false);

  // Camera & Scanner specific runtime hooks
  const [permission, requestPermission] = useCameraPermissions();
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scanningPaused, setScanningPaused] = useState(false);

  // Consolidated Business Validation & Database Insertion Flow
  const executeCoreCheckIn = async (rawCredentialInput: string) => {
    if (!rawCredentialInput.trim()) return;
    setProcessing(true);

    let finalIdToken = rawCredentialInput.trim();

    // 1. Cross-platform custom pass structural unpack matrix
    try {
      const parsedPayload = JSON.parse(finalIdToken);
      if (
        parsedPayload &&
        parsedPayload.vaf === "vitafit-pass" &&
        parsedPayload.uid
      ) {
        finalIdToken = parsedPayload.uid;
      }
    } catch {
      // Non-JSON format detected: Fall back to testing it as raw text
    }

    try {
      if (!supabase) {
        Alert.alert("Error", "Database client not initialized.");
        return;
      }
      // 2. Fetch profile validations using the targeted identifier
      const { data: profile, error: profileErr } = await supabase
        .from("members")
        .select("id, full_name, status, expiry_date")
        .eq("id", finalIdToken)
        .maybeSingle();

      if (profileErr || !profile) {
        throw new Error(
          "No record matches this digital pass token in the registry.",
        );
      }

      // 3. Evaluate registration boundaries
      const todayStr = getSystemTodayStr();
      if (profile.expiry_date && profile.expiry_date < todayStr) {
        Alert.alert(
          "Access Denied",
          `Membership for ${profile.full_name} expired on ${profile.expiry_date}`,
          [{ text: "OK", onPress: () => setScanningPaused(false) }],
        );
        return;
      }

      // 4. Record real transaction event entry
      const { error: logErr } = await supabase.from("check_ins").insert({
        member_id: profile.id,
        member_name: profile.full_name,
        date: todayStr,
        check_in_at: getSystemTimestamp(),
        status: "verified",
      });

      if (logErr) throw logErr;

      Alert.alert(
        "Check-In Complete",
        `Verified access for ${profile.full_name}`,
        [{ text: "Next Scan", onPress: () => setScanningPaused(false) }],
      );

      setMemberId("");
    } catch (err: any) {
      Alert.alert("Verification Failed", err.message, [
        { text: "Dismiss", onPress: () => setScanningPaused(false) },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleManualCheckInSubmit = () => {
    executeCoreCheckIn(memberId);
  };

  const handleBarcodeScannedCallback = ({ data }: { data: string }) => {
    if (scanningPaused || processing) return;
    setScanningPaused(true); // Lock threads immediately to block race double-scans
    executeCoreCheckIn(data);
  };

  const toggleScannerMode = async () => {
    if (!permission?.granted) {
      const request = await requestPermission();
      if (!request.granted) {
        Alert.alert(
          "Permission Required",
          "Camera hardware access is necessary to read QR membership badges.",
        );
        return;
      }
    }
    setShowCameraScanner(!showCameraScanner);
    setScanningPaused(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>Attendance Validation Desk</Text>

      {/* Mode Switch Panel */}
      <TouchableOpacity
        style={styles.toggleModeButton}
        onPress={toggleScannerMode}
      >
        {showCameraScanner ? (
          <>
            <Keyboard size={18} color="#3b82f6" />
            <Text style={styles.toggleModeText}>
              Switch to Keyboard Manual Entry
            </Text>
          </>
        ) : (
          <>
            <QrCode size={18} color="#10b981" />
            <Text style={[styles.toggleModeText, { color: "#10b981" }]}>
              Initialize Video QR Cam Scanner
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* CONDITIONAL INTERFACE RENDERING PANEL */}
      {showCameraScanner ? (
        <View style={styles.scannerWrapper}>
          <View style={styles.viewfinderEnclosure}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={
                scanningPaused ? undefined : handleBarcodeScannedCallback
              }
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />

            {/* Corrected Overlay Layer: Placed as absolute sibling container */}
            <View style={styles.hudOverlayFrame} pointerEvents="box-none">
              <View style={styles.scannerTarget} pointerEvents="box-none">
                <ScanLine size={40} color="#00FF00" style={styles.aimLine} />
                <View style={[styles.cornerBox, styles.topLeft]} />
                <View style={[styles.cornerBox, styles.topRight]} />
                <View style={[styles.cornerBox, styles.bottomLeft]} />
                <View style={[styles.cornerBox, styles.bottomRight]} />
              </View>
            </View>
          </View>

          <Text style={styles.scannerHint}>
            {scanningPaused
              ? "Evaluating token data registry..."
              : "Hold digital pass steady inside the target frame"}
          </Text>

          {scanningPaused && !processing && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setScanningPaused(false)}
            >
              <RefreshCw size={14} color="#ffffff" />
              <Text style={styles.resetButtonText}>Resume Cam Feed</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.manualFormCard}>
          <Text style={styles.fieldLabel}>
            Alphanumeric Security Credential Code
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Member Unique ID or paste pass string"
            placeholderTextColor="#4b5563"
            value={memberId}
            onChangeText={setMemberId}
            autoCapitalize="none"
            editable={!processing}
          />
          <TouchableOpacity
            style={[
              styles.button,
              (!memberId.trim() || processing) && styles.buttonDisabled,
            ]}
            onPress={handleManualCheckInSubmit}
            disabled={!memberId.trim() || processing}
          >
            {processing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                Acknowledge Identity Check-In
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  scrollContent: { padding: 24, justifyContent: "center", paddingTop: 60 },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  toggleModeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  toggleModeText: { color: "#3b82f6", fontWeight: "600", fontSize: 14 },

  // Manual Input Card Formatting
  manualFormCard: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  fieldLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#030712",
    color: "#ffffff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#374151",
    fontSize: 15,
  },
  button: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#1f2937", opacity: 0.6 },
  buttonText: { color: "#ffffff", fontWeight: "bold", fontSize: 15 },

  // Camera Scanner Viewfinder Formatting
  scannerWrapper: { alignItems: "center", gap: 16 },
  viewfinderEnclosure: {
    width: 280,
    height: 280,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1f2937",
    backgroundColor: "#000000",
    position: "relative", // Ensures internal alignment maps correctly
  },
  hudOverlayFrame: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  scannerTarget: {
    width: 190,
    height: 190,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  aimLine: {
    position: "absolute",
  },
  scannerHint: {
    color: "#6b7280",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },

  // HUD Crosshair Anchors styling
  cornerBox: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#00FF00",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },

  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  resetButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "bold" },
});
