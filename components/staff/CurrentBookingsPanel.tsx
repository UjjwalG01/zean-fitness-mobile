import { useQuery } from "@tanstack/react-query";
import { Clock, CreditCard, User } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useDatabase } from "@/contexts/DatabaseContext";

interface MemberRelation {
  name: string | null;
}

export interface SchemaBookingItem {
  id: string;
  member_id: string | null;
  member_name: string | null;
  service_name: string | null;
  class_name: string | null;
  start_at: string;
  start_time: string | null;
  status: string;
  booking_status: string;
  rate: number | null;
  original_rate: number | null;
  members?: MemberRelation | MemberRelation[] | null;
}

interface CurrentBookingsPanelProps {
  outletId: string;
  onSelectBilling: (params: {
    bookingId: string;
    memberId: string;
    amount?: number;
  }) => void;
}

export default function CurrentBookingsPanel({
  outletId,
  onSelectBilling,
}: CurrentBookingsPanelProps) {
  const { supabase } = useDatabase();

  // Fetch active bookings using actual table schema columns
  const {
    data: bookings = [],
    isLoading,
    error,
  } = useQuery<SchemaBookingItem[]>({
    queryKey: ["active-bookings", outletId],
    queryFn: async () => {
      if (!supabase || !outletId) return [];

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          member_id,
          member_name,
          service_name,
          class_name,
          start_at,
          start_time,
          status,
          booking_status,
          rate,
          original_rate,
          members ( name )
        `,
        )
        .eq("outlet_id", outletId)
        .in("status", ["pending", "confirmed"])
        .order("start_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as SchemaBookingItem[]) || [];
    },
    enabled: Boolean(supabase && outletId),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Fetching live bookings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Failed to load bookings: {(error as Error)?.message}
        </Text>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No active bookings at this location right now.
        </Text>
      </View>
    );
  }

  const renderBookingCard = ({ item }: { item: SchemaBookingItem }) => {
    // 1. Safe time parsing from start_at / start_time
    const timeString = item.start_at || item.start_time;
    let checkInDisplay = "--:--";
    if (timeString) {
      try {
        const timePart = timeString.includes("T")
          ? timeString.split("T")[1]
          : timeString.split(" ")[1];
        if (timePart) {
          checkInDisplay = timePart.substring(0, 5);
        }
      } catch {
        checkInDisplay = "--:--";
      }
    }

    // 2. Fall back to denormalized member_name, then joined member name
    const memberObj = Array.isArray(item.members)
      ? item.members[0]
      : item.members;
    const displayName = item.member_name || memberObj?.name || "Walk-in Guest";

    // 3. Fall back to rate or original_rate
    const displayRate = item.rate ?? item.original_rate ?? 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.memberInfo}>
            <User size={18} color="#9ca3af" style={styles.icon} />
            <Text style={styles.memberName}>{displayName}</Text>
          </View>
          <View style={styles.timeInfo}>
            <Clock size={16} color="#6b7280" style={styles.icon} />
            <Text style={styles.timeText}>{checkInDisplay}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.amountLabel}>Booking Rate</Text>
            <Text style={styles.amountValue}>
              NPR{" "}
              {displayRate.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.billingButton}
            onPress={() =>
              onSelectBilling({
                bookingId: item.id,
                memberId: item.member_id || "",
                amount: displayRate,
              })
            }
            activeOpacity={0.8}
          >
            <CreditCard size={18} color="#ffffff" style={styles.btnIcon} />
            <Text style={styles.billingButtonText}>Settle Bill</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={bookings}
      keyExtractor={(item) => item.id}
      renderItem={renderBookingCard}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    marginTop: 10,
  },
  loadingText: {
    color: "#9ca3af",
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    borderStyle: "dashed",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
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
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 8,
  },
  memberName: {
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "600",
  },
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeText: {
    color: "#d1d5db",
    fontSize: 13,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  amountLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 4,
  },
  amountValue: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "bold",
  },
  billingButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnIcon: {
    marginRight: 6,
  },
  billingButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
