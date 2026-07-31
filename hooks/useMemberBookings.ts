// hooks/useMemberBookings.ts
import { useDatabase } from "@/contexts/DatabaseContext";
import { useQuery } from "@tanstack/react-query";

export interface BookingActivity {
    id: string;
    created_at: string;
    start_at: string;
    status: "pending" | "amended" | "cancelled" | "completed";
    service_name?: string | null;
    service_type?: string | null;
    class_name?: string | null;
    rate?: number | null;
}

export function useMemberBookings(activeTab: "upcoming" | "past") {
    // 🚀 FIX: Get user and dynamic Supabase client directly from DatabaseContext
    const { user, supabaseRead, supabase, isLoading: dbLoading } = useDatabase();

    const client = supabaseRead || supabase;

    return useQuery({
        queryKey: ["member-bookings", user?.id, activeTab],
        enabled: Boolean(user?.id) && Boolean(client) && !dbLoading,
        queryFn: async () => {
            const targetMemberId = user?.id;
            if (!targetMemberId || !client) return [];

            let query = client
                .from("bookings")
                .select(
                    `
          id,
          created_at,
          start_at,
          status,
          service_name,
          service_type,
          class_name,
          rate
          `
                )
                .eq("member_id", targetMemberId);

            if (activeTab === "upcoming") {
                query = query
                    .gte("start_at", new Date().toISOString())
                    .order("start_at", { ascending: true });
            } else {
                query = query
                    .lt("start_at", new Date().toISOString())
                    .order("start_at", { ascending: false });
            }

            const { data, error } = await query;
            if (error) {
                console.error("[useMemberBookings] Error fetching data:", error.message);
                throw error;
            }

            return (data as BookingActivity[]) || [];
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}