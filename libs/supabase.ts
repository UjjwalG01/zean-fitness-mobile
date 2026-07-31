// libs/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-url-polyfill/auto';

// 1. Hardware Storage Adapter (iOS Keychain / Android Keystore)
export const MobileSecureStoreAdapter = {
    getItem: async (key: string) => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error('SecureStore read error:', error);
            return null;
        }
    },
    setItem: async (key: string, value: string) => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.error('SecureStore write error:', error);
        }
    },
    removeItem: async (key: string) => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('SecureStore deletion error:', error);
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
    console.warn('Missing Supabase environment variables. Check your .env file.');
}

// 3. Dynamic Factory Function (Used during QR Code Property Pairing)
export function createDynamicSupabaseClient(
    url: string = defaultUrl,
    anonKey: string = defaultAnonKey,
    readReplicaUrl?: string
): {
    supabase: SupabaseClient;
    supabaseRead: SupabaseClient;
    cleanupListeners: () => void
} {
    const primaryUrl = url;
    const replicaUrl = readReplicaUrl || primaryUrl;

    const supabase = createClient(primaryUrl, anonKey, {
        auth: {
            storage: MobileSecureStoreAdapter,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    });

    const supabaseRead = createClient(replicaUrl, anonKey, {
        auth: {
            // In-memory session only to avoid SecureStore write collisions with primary client
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    // Sync session from Primary -> Read Client immediately on creation
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && supabaseRead) {
            supabaseRead.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });
        }
    });

    // Listen for future token changes & handle logout sync cleanly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && supabaseRead) {
            await supabaseRead.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });
        } else if (!session && supabaseRead) {
            // Ensure read client is purged when primary client signs out
            await supabaseRead.auth.signOut();
        }
    });

    // Bind AppState auto-refresh to the new primary client instance
    const appStateSubscription = bindAppStateAutoRefresh(supabase);

    // Cleanup function to prevent memory leaks during property switches
    const cleanupListeners = () => {
        subscription.unsubscribe();
        appStateSubscription.remove();
    };

    return { supabase, supabaseRead, cleanupListeners };
}

// 4. AppState Listener for Auto-Refresh
export function bindAppStateAutoRefresh(client: SupabaseClient) {
    return AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
            client.auth.startAutoRefresh();
        } else {
            client.auth.stopAutoRefresh();
        }
    });
}

// 5. Default Fallback Instances
const defaultClients = createDynamicSupabaseClient(
    defaultUrl,
    defaultAnonKey,
    defaultReadUrl
);

export const supabase = defaultClients.supabase;
export const supabaseRead = defaultClients.supabaseRead;