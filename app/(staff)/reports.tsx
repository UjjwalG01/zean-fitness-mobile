import Skeleton from "@/components/Skeleton";
import { useDatabase } from "@/contexts/DatabaseContext";
import {
  getSystemMonthStr,
  getSystemTodayStr,
  SYSTEM_TZ,
} from "@/libs/timeUtils";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  CheckSquare,
  TrendingUp,
  Users,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// 🚀 FIXED: Interface updated to represent property-wide manager metrics
interface AdminAnalyticsSummary {
  totalMembers: number;
  monthlyRevenue: number;
  totalBookings: number;
  todayCheckIns: number;
}

export default function ReportsScreen() {
  // 🚀 FIX: Get authenticated clients and user from context
  const { supabase, supabaseRead, config, activeUser } = useDatabase();
  
  const currentMonth = getSystemMonthStr(); // e.g. "2026-07"
  const todayStr = getSystemTodayStr(); // e.g. "2026-07-04"
  const [refreshing, setRefreshing] = useState(false);

  // Determine if user is admin/owner to bypass outlet filtering
  const staffRole = (activeUser as any)?.role || "";
  const isAdmin = ["admin", "owner", "superadmin", "manager"].includes(
    String(staffRole).toLowerCase()
  );
  const staffOutletId = (activeUser as any)?.outlet_id;

  const {
    data: summary,
    isLoading,
    refetch,
  } = useQuery<AdminAnalyticsSummary>({
    // 🚀 FIX: Dynamic query key including property URL
    queryKey: ["admin-property-analytics", config?.supabaseUrl, todayStr, currentMonth],
    queryFn: async () => {
      if (!supabaseRead || !supabase) throw new Error("No database connection");

      // 1. Total Registered Members count (Global Property Headcount)
      let membersQuery = supabaseRead
        .from("members")
        .select("*", { count: "exact", head: true });
      
      // 🚀 FIX: Flexible outlet scoping for non-admin users
      if (!isAdmin && staffOutletId) {
        membersQuery = membersQuery.eq("outlet_id", String(staffOutletId));
      }
      
      const { count: memberCount, error: memberErr } = await membersQuery;
      if (memberErr) throw memberErr;

      // 2. MTD Property Revenue Aggregation (All completed payments this month)
      let revenueQuery = supabase
        .from("transactions")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", `${currentMonth}-01T00:00:00`);
      
      // 🚀 FIX: Flexible outlet scoping for non-admin users
      if (!isAdmin && staffOutletId) {
        revenueQuery = revenueQuery.eq("outlet_id", String(staffOutletId));
      }
      
      const { data: revenueData, error: revErr } = await revenueQuery;
      if (revErr) throw revErr;

      const revenueSum = (revenueData || []).reduce(
        (acc, row) => acc + (row.total || 0),
        0,
      );

      // 3. Total Property Bookings Made
      let bookingsQuery = supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed");
      
      // 🚀 FIX: Flexible outlet scoping for non-admin users
      if (!isAdmin && staffOutletId) {
        bookingsQuery = bookingsQuery.eq("outlet_id", String(staffOutletId));
      }
      
      const { count: bookingCount, error: bookErr } = await bookingsQuery;
      if (bookErr) throw bookErr;

      // 4. Today's Total Verified Property Check-Ins
      let checkInsQuery = supabase
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .eq("check_in_date", todayStr);
      
      // 🚀 FIX: Flexible outlet scoping for non-admin users
      if (!isAdmin && staffOutletId) {
        checkInsQuery = checkInsQuery.eq("outlet_id", String(staffOutletId));
      }
      
      const { count: checkInCount, error: checkErr } = await checkInsQuery;
      // .eq("status", "verified");
      if (checkErr) throw checkErr;

      return {
        totalMembers: memberCount || 0,
        monthlyRevenue: revenueSum,
        totalBookings: bookingCount || 0,
        todayCheckIns: checkInCount || 0,
      };
    },
    // 🚀 FIX: Only run query when clients and config are ready
    enabled: !!supabaseRead && !!supabase && !!config?.supabaseUrl,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.warn("Dashboard sync refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Mirror the Title */}
        <Skeleton
          width={180}
          height={22}
          borderRadius={4}
          style={{ marginBottom: 10 }}
        />

        {/* Mirror the Grid Panels layout */}
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((key) => (
            <View key={key} style={styles.card}>
              <View style={styles.cardHeader}>
                <Skeleton width={120} height={14} />
                <Skeleton width={20} height={20} borderRadius={10} />
              </View>
              <Skeleton width={80} height={32} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>

        {/* Mirror the Bottom Notice Box */}
        <View style={[styles.noticeBox, { backgroundColor: "transparent" }]}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="100%" height={12} />
            <Skeleton width="60%" height={12} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
          colors={["#3b82f6"]}
          progressBackgroundColor="#111827"
        />
      }
    >
      <Text style={styles.sectionTitle}>Property Management Insights</Text>

      {/* Metric Grid Panels */}
      <View style={styles.grid}>
        {/* Card 1: Total Registered Headcount */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TOTAL MEMBERS</Text>
            <Users size={20} color="#3b82f6" />
          </View>
          <Text style={styles.cardValue}>
            {summary?.totalMembers.toLocaleString() ?? "0"}
          </Text>
        </View>

        {/* Card 2: Property Gross Revenue */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>MONTHLY REVENUE (MTD)</Text>
            <TrendingUp size={20} color="#10b981" />
          </View>
          <Text style={styles.cardValue}>
            NPR {summary?.monthlyRevenue.toLocaleString() ?? "0"}
          </Text>
        </View>

        {/* Card 3: Total Bookings Reserved */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TOTAL BOOKINGS MADE</Text>
            <Calendar size={20} color="#f59e0b" />
          </View>
          <Text style={styles.cardValue}>
            {summary?.totalBookings.toLocaleString() ?? "0"}
          </Text>
        </View>

        {/* Card 4: Today's Foot Traffic Verification */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TODAY'S CHECK-INS</Text>
            <CheckSquare size={20} color="#a855f7" />
          </View>
          <Text style={styles.cardValue}>
            {summary?.todayCheckIns.toLocaleString() ?? "0"}
          </Text>
        </View>
      </View>

      {/* Operational Breakdown Notice */}
      <View style={styles.noticeBox}>
        <BarChart3 size={22} color="#60a5fa" />
        <Text style={styles.noticeText}>
          Metrics summarize global transactions and activity logs across the
          entire property using the{" "}
          <Text style={styles.boldText}>{SYSTEM_TZ || "Asia/Kathmandu"}</Text>{" "}
          timezone schedule.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  scrollContent: { padding: 16, gap: 20 },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  grid: { gap: 14 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  cardValue: { color: "#ffffff", fontSize: 24, fontWeight: "bold" },
  noticeBox: {
    flexDirection: "row",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: "center",
  },
  noticeText: { color: "#9ca3af", fontSize: 13, flex: 1, lineHeight: 18 },
  boldText: { color: "#ffffff", fontWeight: "600" },
});
