// app/(client)/index.tsx
import BiometricSetup from "@/components/BiometricSetup";
import { HeaderLogoutButton } from "@/components/HeaderLogoutButton";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MailIcon, ShieldCheck, Sparkles, User } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useDatabase } from "../../contexts/DatabaseContext";

export default function ClientDashboard() {
  // 🚀 FIX 1: Use unified logout helper directly from useAuth hook
  const { user, supabaseRead, supabase, userRole } = useDatabase();
  const router = useRouter();

  const client = supabaseRead || supabase;

  // 🚀 FIX 2: Fetch fresh profile, but allow soft fallback to local session state
  const { data: remoteMember, isLoading } = useQuery({
    queryKey: ["client-profile", user?.id || user?.email],
    enabled: !!(user?.id || user?.email),
    queryFn: async () => {
      console.log("Fetching member profile for:", user?.id || user?.email);

      if (!client) throw new Error("No active database client found.");

      const query = client
        .from("members")
        .select("id, full_name, email, tier, status, member_code, role");

      // Query by ID if available, otherwise fallback to email
      const { data, error } = user?.id
        ? await query.eq("id", user.id).maybeSingle()
        : await query
            .eq("email", user?.email?.toLowerCase().trim())
            .maybeSingle();

      if (error) {
        console.error("Supabase fetch member error:", error);
        throw error;
      }
      console.log("Member data: ", data);
      return data;
    },
    retry: 1, // Minimize unnecessary network retries if offline or blocked by RLS
  });

  // Combine remote database profile with local useAuth fallback data
  const member = remoteMember || {
    id: user?.id || "",
    email: user?.email || "No email registered",
    full_name: (user as any)?.full_name || "Valued Member",
    member_code: (user as any)?.member_code || "---",
    tier: (user as any)?.tier || "Basic Tier",
    status: (user as any)?.status || "Active",
    role: "Member",
  };

  // Only show full loading spinner if we have no local or remote user data
  if (isLoading && !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const qrKeyIdentifier = member.id || member.member_code || "GUEST_USER";

  // Formulate the serialized scanning passport structure
  const qrPayload = JSON.stringify({
    uid: qrKeyIdentifier,
    code: member.member_code || "N/A",
    name: member.full_name || "Guest",
    tier: member.tier || "Basic",
    vaf: "vitafit-pass",
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome Banner Header */}
      {/* <View style={styles.welcomeBox}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.memberName}>
          {member.full_name || "Valued Member"}
        </Text>
      </View> */}

      {/* --- DIGITAL MEMBERSHIP PASS CARD --- */}
      <View style={styles.passCard}>
        {/* Top Branding Bar */}
        <View style={styles.cardHeader}>
          <View style={styles.brandRow}>
            <Sparkles size={18} color="#60a5fa" />
            <Text style={styles.brandText}>ZEANFIT DIGITAL PASS</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {(member.status || "Active").toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Mid Section: QR Code Render Enclosure */}
        <View style={styles.qrContainer}>
          <View style={styles.qrWhiteFrame}>
            <QRCode
              value={qrPayload}
              size={160}
              backgroundColor="#ffffff"
              color="#030712"
            />
          </View>
          <Text style={styles.scanInstruction}>
            Present at front desk scanner to check-in
          </Text>
        </View>

        {/* Bottom Metadata Ledger Section */}
        <View style={styles.cardFooter}>
          <View style={styles.metaColumn}>
            <Text style={styles.metaLabel}>MEMBERSHIP TIER</Text>
            <Text style={styles.metaValue}>{member.tier || "Basic Tier"}</Text>
          </View>
          <View style={[styles.metaColumn, { alignItems: "flex-end" }]}>
            <Text style={styles.metaLabel}>MEMBER CODE</Text>
            <Text style={styles.metaValueCode}>
              {member.member_code || "---"}
            </Text>
          </View>
        </View>
      </View>

      {/* Welcome Banner Header */}
      <View style={styles.detailsGroup}>
        <View style={styles.detailRow}>
          <User size={18} color="#9ca3af" />
          <Text style={styles.detailLabel}>Member Name: </Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {member.full_name || "Valued Member"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MailIcon size={18} color="#9ca3af" />
          <Text style={styles.detailLabel}>Registered Email:</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {member.email || "No email"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <ShieldCheck size={18} color="#9ca3af" />
          <Text style={styles.detailLabel}>System Permission:</Text>
          <Text style={styles.detailValue}>
            {(member.role || "Member").toUpperCase()}
          </Text>
        </View>
      </View>

      {/* My Activity Page */}
      {/* <MemberAcitvity /> */}

      {/* Biometric Setup Integration */}
      <BiometricSetup />

      {/* Logout button here */}
      <HeaderLogoutButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeBox: { marginBottom: 24, marginTop: 6 },
  greeting: { color: "#6b7280", fontSize: 14 },
  memberName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 2,
  },
  passCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#374151",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandText: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  statusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: { color: "#10b981", fontSize: 10, fontWeight: "bold" },
  qrContainer: {
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
  },
  qrWhiteFrame: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  scanInstruction: {
    color: "#4b5563",
    fontSize: 12,
    marginTop: 16,
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: "#374151",
  },
  metaColumn: { gap: 2 },
  metaLabel: {
    color: "#9ca3af",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  metaValue: { color: "#ffffff", fontSize: 14, fontWeight: "bold" },
  metaValueCode: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  actionBtn: { marginBottom: 16 },
  actionText: { color: "#10b981", fontWeight: "bold" },
  detailsGroup: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginVertical: 6,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#1f2937",
    gap: 10,
  },
  detailLabel: { color: "#6b7280", fontSize: 14, flex: 1 },
  detailValue: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  activityBtn: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
});
