// activities.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookingActivity,
  useMemberBookings,
} from "../../hooks/useMemberBookings";

export default function ActivitiesScreen() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  // Fetch bookings using updated hook (Supabase read)
  const {
    data: activities = [],
    isLoading,
    isRefetching,
    refetch,
    isError,
    error,
  } = useMemberBookings(activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
      case "completed":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "cancelled":
        return "#ef4444";
      default:
        return "#9ca3af";
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      dateStr: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      timeStr: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const renderItem = ({ item }: { item: BookingActivity }) => {
    const { dateStr, timeStr } = formatDateTime(item.start_at);

    const title = item.service_name || item.class_name || "Fitness Session";
    const category = item.service_type || "Club Service";

    const isActiveMembership =
      item.service_type?.toLowerCase() === "membership" &&
      item.status === "pending";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.serviceName}>{title}</Text>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isActiveMembership
                  ? "#3b82f6"
                  : getStatusColor(item.status) + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: isActiveMembership
                    ? "white"
                    : getStatusColor(item.status),
                },
              ]}
            >
              {isActiveMembership
                ? "Active Membership"
                : item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.categoryText}>{category}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {dateStr} • {timeStr}
          </Text>

          {item.rate !== undefined && item.rate !== null && (
            <Text style={styles.rateText}>
              NPR {item.rate.toLocaleString()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "upcoming" && styles.activeTab]}
          onPress={() => setActiveTab("upcoming")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "upcoming" && styles.activeTabText,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "past" && styles.activeTab]}
          onPress={() => setActiveTab("past")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "past" && styles.activeTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : isError ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: "#ef4444" }]}>
            Failed to load activities: {(error as Error)?.message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#3b82f6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No {activeTab} activities found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712", paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 6 },
  activeTab: { backgroundColor: "#1f2937" },
  tabText: { color: "#9ca3af", fontWeight: "600", fontSize: 14 },
  activeTabText: { color: "#ffffff" },
  listContainer: { gap: 12, paddingBottom: 24, flexGrow: 1 },
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
    marginBottom: 4,
  },
  serviceName: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  categoryText: { color: "#9ca3af", fontSize: 13, marginBottom: 12 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  rateText: { color: "#10b981", fontSize: 13, fontWeight: "bold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "bold" },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: { color: "#6b7280", fontStyle: "italic", textAlign: "center" },
});
