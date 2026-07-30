import * as SecureStore from 'expo-secure-store';

export interface PropertyConfig {
    propertyName: string;
    supabaseUrl: string;
    supabasePublishableKey: string;
    outletId?: string;
}

const STORAGE_KEY = 'zean_property_config';

export const savePropertyConfig = async (config: PropertyConfig): Promise<void> => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(config));
};

export const getPropertyConfig = async (): Promise<PropertyConfig | null> => {
    const data = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!data) return null;
    try {
        return JSON.parse(data) as PropertyConfig;
    } catch {
        return null;
    }
};

export const clearPropertyConfig = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
};