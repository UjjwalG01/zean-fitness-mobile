// hooks/useMemberProfile.ts
import { useDatabase } from "@/contexts/DatabaseContext";
import { useQuery } from "@tanstack/react-query";

export function useMemberProfile(memberId: string) {
    const { supabase } = useDatabase();

    return useQuery({
        queryKey: ["member-profile", memberId],
        queryFn: async () => {
            if (!supabase) throw new Error("Database client not available.");

            const { data, error } = await supabase
                .from("members")
                .select("*")
                .eq("id", memberId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!memberId,
    });
}