// libs/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-url-polyfill/auto';

// 1. Safe Hardware Storage Adapter (Handles Android 2KB Limit)
export const MobileSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error('[SecureStore] Read error:', error);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error: any) {
            console.error('[SecureStore] Write error (Value length:', value.length, '):', error);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('[SecureStore] Deletion error:', error);
        }
    },
};

// 2. Default Environment Variables
const defaultUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://hhiinhpkagzcwtwmqlny.supabase.co';
const defaultAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_G9D_eyHULrCBiOuI-DPsSg_ieFB7s-z';
const defaultReadUrl =
    process.env.EXPO_PUBLIC_SUPABASE_READ_REPLICA_URL || defaultUrl;

if (!defaultUrl || !defaultAnonKey) {
    console.warn('[Supabase] Missing environment variables in .env file.');
}

// Helper: Extract unique project reference for storage key isolation
function getStorageKey(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        const projectRef = hostname.split('.')[0];
        return `sb-${projectRef}-auth-token`;
    } catch {
        return 'sb-auth-token';
    }
}

// 3. Dynamic Factory Function (Used during Property Switching)
export function createDynamicSupabaseClient(
    url: string = defaultUrl,
    anonKey: string = defaultAnonKey,
    readReplicaUrl?: string
): {
    supabase: SupabaseClient;
    supabaseRead: SupabaseClient;
    cleanupListeners: () => void;
} {
    const primaryUrl = url;
    const replicaUrl = readReplicaUrl || primaryUrl;
    const storageKey = getStorageKey(primaryUrl);

    // Primary Client (Read/Write + Session Persistence)
    const supabase = createClient(primaryUrl, anonKey, {
        auth: {
            storage: MobileSecureStoreAdapter,
            storageKey,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    });

    // Read Replica Client (In-memory session, no storage writes)
    const supabaseRead = createClient(replicaUrl, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    // Sync Session to Read Client safely without redundant network calls
    const syncReadSession = (session: any) => {
        if (session?.access_token && session?.refresh_token) {
            supabaseRead.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            }).catch(() => { });
        } else {
            supabaseRead.auth.signOut().catch(() => { });
        }
    };

    // Initial session sync
    supabase.auth.getSession().then(({ data: { session } }) => {
        syncReadSession(session);
    });

    // Listen for Auth changes on Primary Client
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
            syncReadSession(session);
        }
    });

    // AppState listener for auto-refresh management
    const appStateSubscription = bindAppStateAutoRefresh(supabase);

    // Explicit Cleanup Function to prevent memory leaks on client teardown
    const cleanupListeners = () => {
        subscription.unsubscribe();
        appStateSubscription.remove();
    };

    return { supabase, supabaseRead, cleanupListeners };
}

// 4. AppState Listener
export function bindAppStateAutoRefresh(client: SupabaseClient) {
    return AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
            client.auth.startAutoRefresh();
        } else {
            client.auth.stopAutoRefresh();
        }
    });
}

// 5. Default Instances
const defaultClients = createDynamicSupabaseClient(
    defaultUrl,
    defaultAnonKey,
    defaultReadUrl
);

export const supabase = defaultClients.supabase;
export const supabaseRead = defaultClients.supabaseRead;
export const cleanupDefaultListeners = defaultClients.cleanupListeners;