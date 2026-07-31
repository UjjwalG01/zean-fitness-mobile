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
  cleanupDefaultListeners,
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
  setMemberSession: (memberData?: any) => Promise<void>;
  clearMemberSession: () => Promise<void>;
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
  const dynamicClientCleanupRef = useRef<(() => void) | null>(null);

  const cleanupListeners = () => {
    if (authSubscriptionRef.current) {
      authSubscriptionRef.current.unsubscribe();
      authSubscriptionRef.current = null;
    }
    if (dynamicClientCleanupRef.current) {
      dynamicClientCleanupRef.current();
      dynamicClientCleanupRef.current = null;
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
    if (authSubscriptionRef.current) {
      authSubscriptionRef.current.unsubscribe();
      authSubscriptionRef.current = null;
    }

    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const determinedRole = await verifyStaffRole(
            client,
            session.user.email,
          );
          // 🚀 FIX 3: Batch update state to prevent transient null-role redirects
          setUser(session.user);
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
        const determinedRole = await verifyStaffRole(
          client,
          session.user.email,
        );
        setUser(session.user);
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

        if (saved?.supabaseUrl && apiKey && isMounted) {
          setConfig(saved);

          // 2. Shut down default module listeners before starting the dynamic client
          cleanupDefaultListeners();

          // 🚀 FIX 2: Capture cleanupListeners from createDynamicSupabaseClient
          const {
            supabase: primaryClient,
            supabaseRead: readClient,
            cleanupListeners: clientCleanup,
          } = createDynamicSupabaseClient(saved.supabaseUrl, apiKey);

          dynamicClientCleanupRef.current = clientCleanup;
          setSupabase(primaryClient);
          setSupabaseRead(readClient);

          bindClientListeners(primaryClient);

          // 🚀 FIX 1: UNBLOCK UI THREAD IMMEDIATELY!
          // Set isLoading = false as soon as property config is verified.
          setIsLoading(false);

          // Run network session verification asynchronously in the background
          checkSession(primaryClient).catch((sessionErr) => {
            console.warn("Background session check error:", sessionErr);
          });

          return;
        }

        if (isMounted) {
          setConfig(null);
          setSupabase(null);
          setSupabaseRead(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("❌ Failed loading DB config:", err);
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
    queryClient.clear();

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

    try {
      setUser(null);
      setUserRole(null);
      cleanupListeners();
      // Ensure default module listeners are also cleaned up if not done already
      cleanupDefaultListeners();

      await Promise.all([
        SecureStore.deleteItemAsync("vitafit_member_session"),
        SecureStore.deleteItemAsync("biometrics_enabled"),
        SecureStore.deleteItemAsync("biometric_email"),
        SecureStore.deleteItemAsync("biometric_secret"),
      ]);

      queryClient.cancelQueries();
      queryClient.clear();

      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn("Cleaned old auth state:", e);
        }
      }

      await savePropertyConfig(newConfig);
      setConfig(newConfig);

      const apiKey =
        newConfig.supabasePublishableKey || (newConfig as any).supabaseAnonKey;

      if (!newConfig.supabaseUrl || !apiKey) {
        throw new Error(
          "Invalid setup QR: Missing Supabase URL or Publishable Key",
        );
      }

      const {
        supabase: primaryClient,
        supabaseRead: readClient,
        cleanupListeners: clientCleanup,
      } = createDynamicSupabaseClient(newConfig.supabaseUrl, apiKey);

      dynamicClientCleanupRef.current = clientCleanup;
      setSupabase(primaryClient);
      setSupabaseRead(readClient);

      bindClientListeners(primaryClient);

      setUser(null);
      setUserRole(null);
    } catch (err) {
      console.error("❌ Failed to setup property:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetProperty = async () => {
    setIsLoading(true);

    try {
      queryClient.cancelQueries();
      queryClient.clear();
      cleanupListeners();

      await Promise.all([
        SecureStore.deleteItemAsync("vitafit_member_session"),
        SecureStore.deleteItemAsync("biometrics_enabled"),
        SecureStore.deleteItemAsync("biometric_email"),
        SecureStore.deleteItemAsync("biometric_secret"),
      ]);

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
    } catch (err) {
      console.error("Error during property reset:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAuth = async () => {
    if (supabase) {
      await checkSession(supabase);
    }
  };

  // 1. LOGIN: Saves token, sets user state, triggers post-login checks
  const setMemberSession = async (memberData: any) => {
    if (!memberData) return;

    await SecureStore.setItemAsync(
      "vitafit_member_session",
      JSON.stringify(memberData),
    );

    if (memberData?.id || memberData?.token) {
      let subId = memberData.id;
      if (memberData.token) {
        try {
          const decoded: { sub?: string } = jwtDecode(memberData.token);
          subId = decoded.sub || subId;
        } catch {}
      }

      setUser({
        id: subId,
        email: memberData.email,
        full_name: memberData.full_name,
      } as AuthUser);
      setUserRole("client");
    }

    if (supabase) {
      checkSession(supabase).catch(() => {});
    }
  };

  // 2. LOGOUT: Clears storage & user state immediately (NO checkSession calls)
  const clearMemberSession = async () => {
    try {
      // Delete session key from storage
      await SecureStore.deleteItemAsync("vitafit_member_session");

      // Immediately clear React state so AppGuardLayout routes to /(auth)/login
      setUser(null);
      setUserRole(null);

      // Unauthenticate local Supabase staff session if present
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to clear member session:", error);
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
        clearMemberSession,
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
