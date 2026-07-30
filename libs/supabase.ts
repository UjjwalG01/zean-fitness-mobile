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
): { supabase: SupabaseClient; supabaseRead: SupabaseClient } {
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
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    return { supabase, supabaseRead };
}

// 4. Default Fallback Instances
const defaultClients = createDynamicSupabaseClient(
    defaultUrl,
    defaultAnonKey,
    defaultReadUrl
);

export const supabase = defaultClients.supabase;
export const supabaseRead = defaultClients.supabaseRead;

// 5. AppState Listener for Auto-Refresh
export function bindAppStateAutoRefresh(client: SupabaseClient) {
    return AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
            client.auth.startAutoRefresh();
        } else {
            client.auth.stopAutoRefresh();
        }
    });
}

// Bind for the fallback instance
bindAppStateAutoRefresh(supabase);