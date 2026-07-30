// contexts/member-context.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDatabase } from "./DatabaseContext";

export interface MemberProfile {
  id: string;
  memberCode: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  tier: string;
  status: string;
  plan?: string;
  joinDate?: string;
  expiryDate?: string;
  dueAmount?: number;
  digitalPassCode?: string;
  [key: string]: any;
}

interface MemberContextType {
  member: MemberProfile | null;
  loading: boolean;
  error: string | null;
  refetchMember: () => Promise<void>;
  setMember: React.Dispatch<React.SetStateAction<MemberProfile | null>>;
}

const MemberContext = createContext<MemberContextType>({
  member: null,
  loading: false,
  error: null,
  refetchMember: async () => {},
  setMember: () => {},
});

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useDatabase();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemberProfile = useCallback(async () => {
    if (!supabase || !user) {
      setMember(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query member record matching user ID or Email from current property DB
      const { data, error: fetchErr } = await supabase
        .from("members")
        .select("*")
        .or(`id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      if (fetchErr) {
        console.error("[MemberContext] Read failed:", fetchErr.message);
        setError(fetchErr.message);
      } else if (data) {
        setMember({
          id: data.id,
          memberCode: data.member_code || data.grc_no || "",
          name:
            data.full_name ||
            data.name ||
            user.user_metadata?.full_name ||
            "Member",
          email: data.email || user.email || "",
          phone: data.phone || "",
          avatar: data.avatar_url || data.avatar || "",
          tier: data.tier || "Basic",
          status: data.status || "active",
          plan: data.plan || data.preferences?.plan || "Monthly",
          joinDate: data.join_date,
          expiryDate: data.expiry_date,
          dueAmount: Number(
            data.due_amount ?? data.preferences?.dueAmount ?? 0,
          ),
          digitalPassCode: data.grc_no || data.member_code || data.id,
          ...data,
        });
      } else {
        // Fallback profile if user exists in auth but not yet populated in members table
        setMember({
          id: user.id,
          memberCode: `MEM-${user.id.slice(0, 5).toUpperCase()}`,
          name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Member",
          email: user.email || "",
          tier: "Basic",
          status: "active",
          digitalPassCode: user.id,
        });
      }
    } catch (err: any) {
      console.error("[MemberContext] Exception:", err);
      setError(err.message || "Failed to load member profile");
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    fetchMemberProfile();
  }, [fetchMemberProfile]);

  const value = useMemo(
    () => ({
      member,
      loading,
      error,
      refetchMember: fetchMemberProfile,
      setMember,
    }),
    [member, loading, error, fetchMemberProfile],
  );

  return (
    <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
  );
}

export const useMember = () => useContext(MemberContext);
