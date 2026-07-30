// hooks/useAuth.ts
import { useDatabase } from "@/contexts/DatabaseContext";
import { User } from "@supabase/supabase-js";
import { useCallback, useMemo } from "react";

export interface AuthUser {
    id: string;
    email: string;
    full_name?: string;
    isCustomMember?: boolean;
    member_code?: string;
    tier?: string;
    token?: string;
}

const STAFF_ROLES = ["admin", "manager", "staff", "superadmin", "owner"];

export function useAuth() {
    const {
        config,
        supabase,
        user: dbUser,
        userRole,
        isLoading: dbLoading,
        refreshAuth,
        logout: dbLogout,
    } = useDatabase();

    const isConfigured = Boolean(config && supabase);

    // Normalize DatabaseUser into a unified AuthUser interface
    const user = useMemo<AuthUser | null>(() => {
        if (!isConfigured || !dbUser) return null;

        // Standard Supabase Auth Users carry 'aud' or 'app_metadata'
        const isSupabaseUser =
            ("aud" in dbUser || "app_metadata" in dbUser || "user_metadata" in dbUser) &&
            !("isCustomMember" in dbUser && dbUser.isCustomMember === true);

        if (isSupabaseUser) {
            const sbUser = dbUser as User;
            return {
                id: sbUser.id,
                email: sbUser.email || "",
                full_name:
                    sbUser.user_metadata?.full_name ||
                    sbUser.user_metadata?.name ||
                    "Staff Member",
                isCustomMember: false,
            };
        }

        // Custom Member session (Client)
        const customMember = dbUser as AuthUser;
        return {
            id: customMember.id,
            email: customMember.email || "",
            full_name: customMember.full_name || "Club Member",
            isCustomMember: true,
            member_code: customMember.member_code || "",
            tier: customMember.tier,
            token: customMember.token,
        };
    }, [dbUser, isConfigured]);

    // Derived role flags for UI convenience
    const normalizedRole = String(userRole || "").trim().toLowerCase();
    const isStaff = Boolean(
        user && !user.isCustomMember && STAFF_ROLES.includes(normalizedRole),
    );
    const isClient = Boolean(user && (!isStaff || user.isCustomMember));

    const logout = useCallback(async () => {
        await dbLogout();
    }, [dbLogout]);

    return {
        user,
        userRole,
        isStaff,
        isClient,
        loading: dbLoading,
        isConfigured,
        refetchSession: refreshAuth,
        logout,
    };
}