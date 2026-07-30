// contexts/DatabaseContext.tsx
import { AuthUser } from "@/hooks/useAuth";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  bindAppStateAutoRefresh,
  createDynamicSupabaseClient,
} from "../libs/supabase";
import {
  PropertyConfig,
  clearPropertyConfig,
  getPropertyConfig,
  savePropertyConfig,
} from "../services/configStorage";

export type DatabaseUser = User | AuthUser;

interface DatabaseContextType {
  supabase: SupabaseClient | null;
  supabaseRead: SupabaseClient | null;
  config: PropertyConfig | null;
  user: DatabaseUser | null;
  userRole: "staff" | "client" | null;
  isLoading: boolean;
  setupProperty: (newConfig: PropertyConfig) => Promise<void>;
  resetProperty: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setMemberSession: (memberData: any) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PropertyConfig | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [supabaseRead, setSupabaseRead] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<DatabaseUser | null>(null);
  const [userRole, setUserRole] = useState<"staff" | "client" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const appStateSubRef = useRef<{ remove: () => void } | null>(null);

  const cleanupListeners = () => {
    if (authSubscriptionRef.current) {
      authSubscriptionRef.current.unsubscribe();
      authSubscriptionRef.current = null;
    }
    if (appStateSubRef.current) {
      appStateSubRef.current.remove();
      appStateSubRef.current = null;
    }
  };

  const verifyStaffRole = async (
    client: SupabaseClient,
    email?: string,
  ): Promise<"staff" | "client"> => {
    if (!email) return "client";

    try {
      const userEmail = email.toLowerCase().trim();
      const { data: staffData } = await client
        .from("app_users")
        .select("role")
        .ilike("email", userEmail)
        .maybeSingle();

      if (staffData?.role) {
        const roleStr = String(staffData.role).toLowerCase().trim();
        const staffRoles = ["admin", "manager", "staff", "superadmin", "owner"];
        if (staffRoles.includes(roleStr)) {
          return "staff";
        }
      }
    } catch (err) {
      console.warn("Error checking app_users role:", err);
    }

    return "client";
  };

  const bindClientListeners = (client: SupabaseClient) => {
    cleanupListeners();
    appStateSubRef.current = bindAppStateAutoRefresh(client);

    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          const determinedRole = await verifyStaffRole(
            client,
            session.user.email,
          );
          setUserRole(determinedRole);
        } else if (event === "SIGNED_OUT") {
          const localMemberJson = await SecureStore.getItemAsync(
            "vitafit_member_session",
          );
          if (!localMemberJson) {
            setUser(null);
            setUserRole(null);
          }
        }
      },
    );

    authSubscriptionRef.current = authListener.subscription;
  };

  const checkSession = async (client: SupabaseClient) => {
    try {
      // 1. Staff session check (Supabase Auth)
      const {
        data: { session },
      } = await client.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const determinedRole = await verifyStaffRole(
          client,
          session.user.email,
        );
        setUserRole(determinedRole);
        return;
      }

      // 2. Member JWT session check
      const localMemberJson = await SecureStore.getItemAsync(
        "vitafit_member_session",
      );
      if (localMemberJson) {
        try {
          const memberData = JSON.parse(localMemberJson);
          if (memberData.token) {
            const decoded: { exp?: number; sub?: string } = jwtDecode(
              memberData.token,
            );

            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
              await SecureStore.deleteItemAsync("vitafit_member_session");
              setUser(null);
              setUserRole(null);
              return;
            }

            if (memberData.refreshToken) {
              await client.auth
                .setSession({
                  access_token: memberData.token,
                  refresh_token: memberData.refreshToken,
                })
                .catch(() => {});
            }

            setUser({
              id: decoded.sub || memberData.id,
              email: memberData.email,
              full_name: memberData.full_name,
            } as AuthUser);
            setUserRole("client");
            return;
          }
        } catch (err) {
          console.warn("Failed to parse member session:", err);
          await SecureStore.deleteItemAsync("vitafit_member_session");
        }
      }

      setUser(null);
      setUserRole(null);
    } catch (err) {
      console.error("Error during checkSession:", err);
      setUser(null);
      setUserRole(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        const saved = await getPropertyConfig();
        const apiKey =
          saved?.supabasePublishableKey || (saved as any)?.supabaseAnonKey;

        if (saved?.supabaseUrl && apiKey) {
          if (!isMounted) return;

          setConfig(saved);

          const { supabase: primaryClient, supabaseRead: readClient } =
            createDynamicSupabaseClient(saved.supabaseUrl, apiKey);

          setSupabase(primaryClient);
          setSupabaseRead(readClient);

          bindClientListeners(primaryClient);

          try {
            await checkSession(primaryClient);
          } catch (sessionErr) {
            console.warn(
              "⚠️ Session check failed gracefully during startup:",
              sessionErr,
            );
          }
        } else {
          if (isMounted) {
            setConfig(null);
            setSupabase(null);
            setSupabaseRead(null);
          }
        }
      } catch (err) {
        console.error("❌ Failed loading DB config:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
      cleanupListeners();
    };
  }, []);

  const logout = async () => {
    setIsLoading(true);
    queryClient.clear(); // 💥 Purge cached queries

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Sign out error:", err);
      }
    }
    await SecureStore.deleteItemAsync("vitafit_member_session");
    setUser(null);
    setUserRole(null);
    setIsLoading(false);
  };

  const setupProperty = async (newConfig: PropertyConfig) => {
    setIsLoading(true);
    queryClient.clear(); // 💥 Purge cached queries from old database

    try {
      // 1. Purge old session state AND local member storage
      setUser(null);
      setUserRole(null);
      cleanupListeners();
      await SecureStore.deleteItemAsync("vitafit_member_session");

      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (e) {
        console.warn("Cleaned old auth state:", e);
      }

      // 2. Persist newly scanned config to storage
      await savePropertyConfig(newConfig);
      setConfig(newConfig);

      const apiKey =
        newConfig.supabasePublishableKey || (newConfig as any).supabaseAnonKey;

      if (!newConfig.supabaseUrl || !apiKey) {
        throw new Error(
          "Invalid setup QR: Missing Supabase URL or Publishable Key",
        );
      }

      // 3. Create fresh client instances
      const { supabase: primaryClient, supabaseRead: readClient } =
        createDynamicSupabaseClient(newConfig.supabaseUrl, apiKey);

      setSupabase(primaryClient);
      setSupabaseRead(readClient);

      // 4. Bind listeners to the new primary client
      bindClientListeners(primaryClient);

      // 5. Session check protected with timeout guard
      try {
        await Promise.race([
          checkSession(primaryClient),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Session check timeout")), 3000),
          ),
        ]);
      } catch (sessionErr) {
        console.warn(
          "⚠️ Session check skipped during new property pairing:",
          sessionErr,
        );
      }
    } catch (err) {
      console.error("❌ Failed to setup property:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetProperty = async () => {
    setIsLoading(true);
    queryClient.clear();
    cleanupListeners();
    await SecureStore.deleteItemAsync("vitafit_member_session");
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    await clearPropertyConfig();
    setConfig(null);
    setSupabase(null);
    setSupabaseRead(null);
    setUser(null);
    setUserRole(null);
    setIsLoading(false);
  };

  const refreshAuth = async () => {
    if (supabase) {
      await checkSession(supabase);
    }
  };

  // Helper for Member Login Screen to save session and force React Router update
  const setMemberSession = async (memberData: any) => {
    await SecureStore.setItemAsync(
      "vitafit_member_session",
      JSON.stringify(memberData),
    );
    if (supabase) {
      await checkSession(supabase);
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
        supabase,
        supabaseRead,
        config,
        user,
        userRole,
        isLoading,
        setupProperty,
        resetProperty,
        logout,
        refreshAuth,
        setMemberSession,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
};
