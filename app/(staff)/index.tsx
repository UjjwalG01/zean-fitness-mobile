// app/(staff)/index.tsx
import Skeleton from "@/components/Skeleton";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useQuery } from "@tanstack/react-query";
import { ExternalPathString, RelativePathString, useRouter } from "expo-router";
import {
  Building2,
  CheckCircle2,
  Clock,
  Receipt,
  Tag,
  User,
  X,
  XCircle,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOutlet } from "../../contexts/OutletContext";

// Enable smooth layout transitions for Android devices
// 🚀 FIX: Removed deprecated UIManager.setLayoutAnimationEnabledExperimental
// This is no-op in React Native New Architecture (Fabric) and causes warnings
// Layout animations are now handled automatically by React Native Reanimated

interface Booking {
  id: string;
  start_at: string;
  outlet_id: string;
  member_name: string | null;
  member_code: string | null;
  member_id: string | null;
  service_name: string | null;
  class_name?: string | null;
  status: string;
  rate?: number | null;
  notes?: string | null;
  cancel_reason?: string | null;
}

export default function DashboardScreen() {
  // 1. ALL HOOKS MUST RUN UNCONDITIONALLY AT THE TOP LEVEL
  const { supabase } = useDatabase();
  const router = useRouter();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const {
    selectedOutlet,
    outlets,
    setSelectedOutletId,
    loading: outletLoading,
  } = useOutlet();

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filterStatus, setFilterStatus] = useState<"active" | "cancelled">(
    "active",
  );

  // 🚀 FIX: Memoize local day bounds so query keys remain completely stable across renders
  const { startIso, endIso } = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    return {
      startIso: startOfDay.toISOString(),
      endIso: endOfDay.toISOString(),
    };
  }, []);

  // Fetch today's live bookings for active outlet
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    isError,
    error,
    refetch,
  } = useQuery<Booking[]>({
    queryKey: [
      "live-outlet-bookings-ledger",
      startIso,
      filterStatus,
      selectedOutlet?.id,
    ],
    queryFn: async () => {
      if (!supabase || !selectedOutlet?.id) return [];

      let query = supabase
        .from("bookings")
        .select("*")
        .eq("outlet_id", selectedOutlet.id)
        .gte("start_at", startIso)
        .lte("start_at", endIso)
        .order("start_at", { ascending: true });

      if (filterStatus === "active") {
        query = query.in("status", ["pending", "confirmed"]);
      } else {
        query = query.eq("status", "cancelled");
      }

      const { data, error: dbError } = await query;

      if (dbError) {
        console.error("Supabase Bookings Query Error:", dbError.message);
        throw new Error(dbError.message);
      }

      return data || [];
    },
    // Only execute query when BOTH supabase client and selected outlet are ready
    enabled: Boolean(supabase && selectedOutlet?.id),
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error("Failed to sync dashboard updates:", err);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleBillingTransition = (booking: Booking) => {
    setSelectedBooking(null);
    router.push({
      pathname: "/(staff)/ledger" as RelativePathString | ExternalPathString,
      params: {
        bookingId: booking.id,
        memberId: booking.member_id || "",
        amount: String(booking.rate ?? 0),
        outletId: selectedOutlet?.id || "",
      },
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const globalLoading =
    outletLoading || (selectedOutlet?.id ? bookingsLoading : false);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      {/* 1. Multi-Outlet Context Switcher */}
      <Text style={styles.label}>Active Outlet Location:</Text>
      {outlets && outlets.length > 0 ? (
        <View style={styles.pickerWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {outlets.map((outlet) => (
              <TouchableOpacity
                key={outlet.id}
                onPress={() => setSelectedOutletId(outlet.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chip,
                    selectedOutlet?.id === outlet.id && styles.activeChip,
                  ]}
                >
                  {outlet.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        /* Fallback Banner when no outlets are configured or returned */
        <View style={styles.noOutletBanner}>
          <Text style={styles.noOutletTitle}>⚠️ No Outlet Available</Text>
          <Text style={styles.noOutletSubtext}>
            No active outlet locations found. Please check database permissions
            (RLS) or add an outlet.
          </Text>
        </View>
      )}

      {/* 2. Dynamic Status Filter Split Controls */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            filterStatus === "active" && styles.toggleActiveConf,
          ]}
          onPress={() => setFilterStatus("active")}
        >
          <CheckCircle2
            size={16}
            color={filterStatus === "active" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[
              styles.toggleText,
              filterStatus === "active" && styles.textWhite,
            ]}
          >
            Active Slots
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            filterStatus === "cancelled" && styles.toggleActiveCan,
          ]}
          onPress={() => setFilterStatus("cancelled")}
        >
          <XCircle
            size={16}
            color={filterStatus === "cancelled" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[
              styles.toggleText,
              filterStatus === "cancelled" && styles.textWhite,
            ]}
          >
            Cancelled
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Current Live Bookings</Text>

      {/* 3. Main Queue List & Empty States */}
      {globalLoading ? (
        <View style={styles.listContainer}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={styles.bookingCardPlaceholder}>
              <View style={styles.cardMain}>
                <Skeleton width="65%" height={16} style={{ marginBottom: 6 }} />
                <Skeleton width="45%" height={12} />
              </View>
              <View style={styles.cardMetaPlaceholder}>
                <Skeleton width={14} height={14} borderRadius={7} />
                <Skeleton width={42} height={14} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.infoText, { color: "#ef4444" }]}>
            Unable to load bookings: {(error as Error)?.message}
          </Text>
        </View>
      ) : !selectedOutlet ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.infoText}>
            No active outlet selected. Please select or add an outlet to view
            live bookings.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
              progressBackgroundColor="#111827"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Text style={styles.infoText}>
                No {filterStatus} bookings scheduled here today.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.bookingCard}
              onPress={() => setSelectedBooking(item)}
            >
              <View style={styles.cardMain}>
                <Text style={styles.memberName}>
                  {item.member_name || "Walk-In Client"}
                </Text>
                <Text style={styles.serviceName}>
                  {item.service_name || item.class_name || "Club Service"}
                </Text>
              </View>
              <View style={styles.cardMeta}>
                <Clock size={14} color="#9ca3af" />
                <Text style={styles.timeText}>{formatTime(item.start_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* 4. Detail Focus Modal */}
      <Modal visible={!!selectedBooking} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Booking Snapshot</Text>
              <TouchableOpacity onPress={() => setSelectedBooking(null)}>
                <X size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <User size={18} color="#6b7280" />
                  <View>
                    <Text style={styles.detailLabel}>MEMBER NAME</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.member_name || "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Tag size={18} color="#6b7280" />
                  <View>
                    <Text style={styles.detailLabel}>SERVICE / CLASS</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.service_name ||
                        selectedBooking.class_name ||
                        "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Clock size={18} color="#6b7280" />
                  <View>
                    <Text style={styles.detailLabel}>SCHEDULE TIME</Text>
                    <Text style={styles.detailValue}>
                      {formatTime(selectedBooking.start_at)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Building2 size={18} color="#6b7280" />
                  <View>
                    <Text style={styles.detailLabel}>RATE MATRIX</Text>
                    <Text style={styles.detailValue}>
                      NPR {selectedBooking.rate?.toLocaleString() || "0"}
                    </Text>
                  </View>
                </View>

                {selectedBooking.notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesTitle}>Internal Staff Notes</Text>
                    <Text style={styles.notesText}>
                      {selectedBooking.notes}
                    </Text>
                  </View>
                )}

                {selectedBooking.status === "cancelled" && (
                  <View style={[styles.notesBox, { borderColor: "#ef4444" }]}>
                    <Text style={[styles.notesTitle, { color: "#ef4444" }]}>
                      Cancellation Reason
                    </Text>
                    <Text style={styles.notesText}>
                      {selectedBooking.cancel_reason ||
                        "No explicit reason specified."}
                    </Text>
                  </View>
                )}

                {(selectedBooking.status === "confirmed" ||
                  selectedBooking.status === "pending") && (
                  <TouchableOpacity
                    style={styles.billingBtn}
                    onPress={() => handleBillingTransition(selectedBooking)}
                  >
                    <Receipt size={18} color="#fff" />
                    <Text style={styles.billingBtnText}>
                      Proceed to POS Checkout
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712", paddingHorizontal: 16 },
  label: { color: "#9ca3af", fontSize: 14, marginBottom: 8, fontWeight: "600" },
  pickerWrapper: { marginBottom: 16 },
  scrollContent: { gap: 8 },
  noOutletBanner: {
    backgroundColor: "#1f2937",
    borderColor: "#eab308",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  noOutletTitle: {
    color: "#eab308",
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4,
  },
  noOutletSubtext: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
  },
  chip: {
    color: "#9ca3af",
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 13,
    overflow: "hidden",
  },
  activeChip: {
    color: "#ffffff",
    backgroundColor: "#3b82f6",
    fontWeight: "bold",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#111827",
    padding: 6,
    marginBottom: 16,
    borderRadius: 8,
    gap: 6,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 6,
    gap: 8,
  },
  toggleActiveConf: { backgroundColor: "#10b981" },
  toggleActiveCan: { backgroundColor: "#ef4444" },
  toggleText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
  textWhite: { color: "#ffffff" },
  listContainer: { gap: 8, paddingBottom: 16, flexGrow: 1 },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
  },
  bookingCard: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardMain: { flex: 1, paddingRight: 12 },
  memberName: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  serviceName: { color: "#9ca3af", fontSize: 13, marginTop: 2 },
  cardMeta: { alignItems: "flex-end", gap: 4 },
  timeText: { color: "#3b82f6", fontSize: 14, fontWeight: "bold" },
  infoText: { color: "#6b7280", fontStyle: "italic", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: "#1f2937",
    paddingBottom: 12,
  },
  modalTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  modalBody: { marginBottom: 20 },
  detailRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  detailLabel: {
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 2,
  },
  notesBox: {
    backgroundColor: "#030712",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginTop: 8,
    marginBottom: 4,
  },
  notesTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
  },
  notesText: { color: "#9ca3af", fontSize: 13, lineHeight: 18 },
  billingBtn: {
    flexDirection: "row",
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  billingBtnText: { color: "#ffffff", fontWeight: "bold", fontSize: 15 },
  bookingCardPlaceholder: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardMetaPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
