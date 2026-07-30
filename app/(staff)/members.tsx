import Skeleton from "@/components/Skeleton";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldAlert, UserCheck, Users } from "lucide-react-native";
import React from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface MemberProfile {
  id: string;
  full_name: string;
  email: string | null;
  tier: string | null;
  status: "active" | "inactive" | string;
  member_code: string | null;
  role: "admin" | "staff" | "manager" | "member" | null;
  outlet_id?: string | null;
}

export default function MembersScreen() {
  // 🚀 FIX: Get authenticated clients and user from context instead of static imports
  const { supabase, supabaseRead, config, activeUser } = useDatabase();
  const queryClient = useQueryClient();

  // Determine if user is admin/owner to bypass outlet filtering
  const staffRole = (activeUser as any)?.role || "";
  const isAdmin = ["admin", "owner", "superadmin", "manager"].includes(
    String(staffRole).toLowerCase()
  );
  const staffOutletId = (activeUser as any)?.outlet_id;

  const {
    data: members,
    isLoading,
    refetch,
  } = useQuery<MemberProfile[]>({
    // 🚀 FIX: Dynamic query key including property URL and user context
    queryKey: ["staff-members", config?.supabaseUrl, staffOutletId, isAdmin],
    queryFn: async () => {
      if (!supabaseRead) throw new Error("No database connection");

      let query = supabaseRead
        .from("members")
        .select("id, full_name, email, tier, status, member_code, role, outlet_id");

      // 🚀 FIX: Flexible outlet scoping - admins see all, staff see only their outlet
      if (!isAdmin && staffOutletId) {
        query = query.eq("outlet_id", String(staffOutletId));
      }

      const { data, error } = await query.order("full_name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    // 🚀 FIX: Only run query when client and config are ready
    enabled: !!supabaseRead && !!config?.supabaseUrl,
    staleTime: 0, // Always refetch on mount for fresh data
  });

  // WRITE OPERATION: Always explicitly routed to the primary master database node
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      id,
      currentStatus,
    }: {
      id: string;
      currentStatus: string;
    }) => {
      if (!supabase) throw new Error("No database connection");
      const nextStatus = currentStatus === "active" ? "inactive" : "active";
      const { data, error } = await supabase
        .from("members")
        .update({ status: nextStatus })
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // 🚀 FIX: Invalidate with matching dynamic query key
      queryClient.invalidateQueries({
        queryKey: ["staff-members", config?.supabaseUrl, staffOutletId, isAdmin],
      });
    },
    onError: (err: any) => {
      Alert.alert("Mutation Failed", err.message);
    },
  });

  const getStatusBadgeStyles = (status: string) => {
    const normalize = status?.toLowerCase();
    if (normalize === "active") {
      return { container: styles.activeBadge, text: styles.activeBadgeText };
    }
    return { container: styles.inactiveBadge, text: styles.inactiveBadgeText };
  };

  const getRoleIcon = (role: string | null) => {
    const normalize = role?.toLowerCase();
    if (normalize === "admin") return <ShieldAlert size={16} color="#ef4444" />;
    if (normalize === "staff" || normalize === "manager")
      return <Shield size={16} color="#3b82f6" />;
    return <UserCheck size={16} color="#10b981" />;
  };

  // 🚀 FIXED: Replaced ActivityIndicator with full-screen structural skeletons
  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Mirror the Summary Top Bar */}
        <View style={styles.summaryBar}>
          <View style={styles.statItem}>
            <Skeleton
              width={20}
              height={20}
              borderRadius={4}
              style={{ marginRight: 8 }}
            />
            <Skeleton width={200} height={14} />
            <Skeleton width={24} height={16} style={{ marginLeft: "auto" }} />
          </View>
        </View>

        {/* Mirror the FlatList Cards layout structure mapping */}
        <View style={styles.listContainer}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={styles.card}>
              {/* Row 1: Name and Action Badge Status */}
              <View style={styles.cardRow}>
                <View style={styles.nameContainer}>
                  <Skeleton
                    width={18}
                    height={18}
                    borderRadius={9}
                    style={{ marginRight: 6 }}
                  />
                  <Skeleton width={130} height={16} />
                </View>
                <Skeleton width={75} height={22} borderRadius={6} />
              </View>

              {/* Row 2: Secondary Email Row string */}
              <Skeleton
                width="55%"
                height={13}
                style={{ marginTop: 10, marginBottom: 14 }}
              />

              {/* Row 3: Meta Footer Items Breakdown */}
              <View style={styles.metaFooter}>
                <Skeleton width={100} height={14} />
                <Skeleton width={70} height={18} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Live Core Data Layout (Executes normally once loading is complete)
  return (
    <View style={styles.container}>
      <View style={styles.summaryBar}>
        <View style={styles.statItem}>
          <Users size={20} color="#3b82f6" style={styles.statIcon} />
          <Text style={styles.statLabel}>
            Total Ledger Profiles (Replica Stream):{" "}
          </Text>
          <Text style={styles.statCount}>{members?.length || 0}</Text>
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={isLoading}
        onRefresh={refetch}
        renderItem={({ item }) => {
          const badgeStyles = getStatusBadgeStyles(item.status || "inactive");
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.nameContainer}>
                  {getRoleIcon(item.role)}
                  <Text style={styles.memberName} numberOfLines={1}>
                    {item.full_name || "Anonymous User"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    toggleStatusMutation.mutate({
                      id: item.id,
                      currentStatus: item.status,
                    })
                  }
                  style={[styles.badgeBase, badgeStyles.container]}
                >
                  <Text style={[styles.badgeText, badgeStyles.text]}>
                    {(item.status || "Inactive").toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.emailText} numberOfLines={1}>
                {item.email || "No email registered"}
              </Text>

              <View style={styles.metaFooter}>
                <Text style={styles.tierText}>
                  Plan Type:{" "}
                  <Text style={styles.boldWhite}>{item.tier || "Basic"}</Text>
                </Text>
                {item.member_code ? (
                  <Text style={styles.roleTag}>{item.member_code}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No registered members found in the system ledger.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryBar: {
    backgroundColor: "#111827",
    padding: 14,
    borderBottomWidth: 1,
    borderColor: "#1f2937",
  },
  statItem: { flexDirection: "row", alignItems: "center" },
  statIcon: { marginRight: 8 },
  statLabel: { color: "#9ca3af", fontSize: 14 },
  statCount: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  listContainer: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  memberName: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  emailText: { color: "#9ca3af", fontSize: 13, marginBottom: 12 },
  metaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierText: { color: "#6b7280", fontSize: 13 },
  boldWhite: { color: "#ffffff", fontWeight: "600" },
  roleTag: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeBase: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeBadge: { backgroundColor: "rgba(16, 185, 129, 0.15)" },
  activeBadgeText: { color: "#10b981" },
  inactiveBadge: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  inactiveBadgeText: { color: "#ef4444" },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#4b5563", fontStyle: "italic", fontSize: 14 },
});
