// hooks/useRole.ts
import { useDatabase } from "@/contexts/DatabaseContext";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

export function useRole() {
    const { user, loading: authLoading } = useAuth();
    const { supabase } = useDatabase(); // Use dynamic DB context client
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Wait until Auth state finishes initializing
        if (authLoading) {
            setLoading(true);
            return;
        }

        // 2. Unauthenticated user
        if (!user) {
            setRole(null);
            setLoading(false);
            return;
        }

        // 3. Custom Member session (logged in via Member Code on Mobile)
        if (user.isCustomMember) {
            setRole("member");
            setLoading(false);
            return;
        }

        async function fetchStaffRole() {
            setLoading(true);

            try {
                const userEmail = user?.email?.toLowerCase().trim();
                if (!userEmail || !supabase) {
                    setRole("member");
                    setLoading(false);
                    return;
                }

                // Query app_users by email
                const { data, error } = await supabase
                    .from("app_users")
                    .select("role")
                    .ilike("email", userEmail)
                    .maybeSingle();

                if (error) {
                    console.error("❌ Supabase RLS or Query Error on app_users:", error.message);
                    setRole("member");
                } else if (data?.role) {
                    const fetchedRole = data.role.toLowerCase().trim();
                    console.log(`✅ Staff Role Resolved for [${userEmail}]:`, fetchedRole);
                    setRole(fetchedRole);
                } else {
                    console.warn(`⚠️ No record found in app_users for [${userEmail}]. Defaulting to 'member'.`);
                    setRole("member");
                }
            } catch (err) {
                console.error("❌ Unexpected error fetching staff role:", err);
                setRole("member");
            } finally {
                setLoading(false);
            }
        }

        fetchStaffRole();
    }, [user, authLoading, supabase]);

    return { role, loading };
}