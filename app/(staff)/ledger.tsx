import Skeleton from "@/components/Skeleton";
import { supabaseRead } from "@/libs/supabase";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

interface TransactionRecord {
  id: string;
  created_at: string;
  total: number;
  method: string;
  status: string;
  member_name: string;
}

export default function LedgerScreen() {
  const { data: transactions, isLoading } = useQuery<TransactionRecord[]>({
    queryKey: ["live-transactions-ledger"],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from("transactions")
        .select("id, member_name, created_at, total, method, status")
        .order("created_at", { ascending: false })
        .limit(50); // FIXED: Safety cap prevents mobile memory layout crashes

      // FIXED: Unhandled Supabase errors will now correctly bubble up to TanStack Query
      if (error) throw error;

      // FIXED: Maps and flattens nested relational data structures seamlessly for your list
      const formattedRecords: TransactionRecord[] = (data || []).map(
        (row: any) => ({
          id: row.id,
          created_at: row.created_at,
          total: row.total,
          method: row.method,
          status: row.status,
          // Fallback handles both flat column setups or relational joins smoothly:
          member_name:
            row.member_name || row.members?.full_name || "Unknown Member",
        }),
      );

      return formattedRecords;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Keeping the header layout intact prevents jarring page jumps */}
        <Text style={styles.title}>Real-time Ledger Logs</Text>

        {Array.from({ length: 5 }).map((_, idx) => (
          <View key={idx} style={styles.rowPlaceholder}>
            <Skeleton width={44} height={44} borderRadius={22} />

            <View style={{ flex: 1, gap: 8, marginLeft: 12 }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="30%" height={12} />
            </View>

            <Skeleton width={60} height={20} />
          </View>
        ))}
      </View>
    );
  }

  // Live Data Return State (Runs seamlessly once isLoading is false)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Real-time Ledger Logs</Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>
                {item.member_name || "Walk-in Guest"}
              </Text>
              <Text style={styles.amount}>
                NPR {item.total.toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.meta}>
                {item.method.toUpperCase()} •{" "}
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
              <Text
                style={[
                  styles.status,
                  {
                    color:
                      item.status === "completed" || item.status === "paid"
                        ? "#10b981"
                        : "#ef4444",
                  },
                ]}
              >
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712", padding: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  rowPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827", // Matches your dark card background
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 12,
  },
  name: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  amount: { color: "#3b82f6", fontWeight: "bold", fontSize: 16 },
  meta: { color: "#9ca3af", fontSize: 13 },
  status: { fontSize: 12, fontWeight: "600" },
});
