import { SupabaseClient } from "@supabase/supabase-js";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const MEMBER_BIOMETRIC_KEY = "member_biometrics_enabled";
const MEMBER_REFRESH_TOKEN_KEY = "member_refresh_token";
const MEMBER_EMAIL_KEY = "member_email";

export const MemberBiometricService = {
    /**
     * Check if hardware biometrics are supported and enrolled on the device
     */
    async isHardwareAvailable(): Promise<boolean> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    },

    /**
     * Check if the member has explicitly enabled biometrics
     */
    async isMemberBiometricsEnabled(): Promise<boolean> {
        const enabled = await SecureStore.getItemAsync(MEMBER_BIOMETRIC_KEY);
        return enabled === "true";
    },

    /**
     * Enable Biometrics for Member: Stores the Refresh Token securely
     */
    async enableMemberBiometrics(refreshToken: string, email: string): Promise<boolean> {
        try {
            const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: "Confirm biometrics to enable quick member login",
                cancelLabel: "Cancel",
                disableDeviceFallback: false,
            });

            if (!authResult.success) return false;

            await SecureStore.setItemAsync(MEMBER_BIOMETRIC_KEY, "true");
            await SecureStore.setItemAsync(MEMBER_REFRESH_TOKEN_KEY, refreshToken);
            await SecureStore.setItemAsync(MEMBER_EMAIL_KEY, email.toLowerCase());
            return true;
        } catch (error) {
            console.error("[MemberBiometricService] Enable biometrics error:", error);
            return false;
        }
    },

    /**
     * Disable Member Biometrics and wipe stored tokens
     */
    async disableMemberBiometrics(): Promise<void> {
        await SecureStore.deleteItemAsync(MEMBER_BIOMETRIC_KEY);
        await SecureStore.deleteItemAsync(MEMBER_REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(MEMBER_EMAIL_KEY);
    },

    /**
     * Execute Biometric Login using Refresh Token Exchange
     */
    async authenticateMemberWithBiometrics(
        supabase: SupabaseClient
    ): Promise<{ success: boolean; session?: any; error?: string }> {
        try {
            const isEnabled = await this.isMemberBiometricsEnabled();
            if (!isEnabled) return { success: false, error: "Biometrics not enabled" };

            const refreshToken = await SecureStore.getItemAsync(MEMBER_REFRESH_TOKEN_KEY);
            if (!refreshToken) {
                await this.disableMemberBiometrics();
                return { success: false, error: "No refresh token found" };
            }

            // Step 1: Prompt OS Biometrics
            const bioResult = await LocalAuthentication.authenticateAsync({
                promptMessage: "Scan fingerprint/Face ID to enter",
                fallbackLabel: "Use Password/Code",
            });

            if (!bioResult.success) {
                return { success: false, error: "Biometric prompt cancelled or failed" };
            }

            // Step 2: Send Refresh Token to Backend (Supabase / Auth Server)
            const { data, error } = await supabase.auth.refreshSession({
                refresh_token: refreshToken,
            });

            if (error || !data.session) {
                // Refresh token expired or revoked on server -> force clear local keys
                await this.disableMemberBiometrics();
                return { success: false, error: "Session expired. Please log in again." };
            }

            // Step 3: Rotate stored Refresh Token with new token returned by server
            if (data.session.refresh_token) {
                await SecureStore.setItemAsync(
                    MEMBER_REFRESH_TOKEN_KEY,
                    data.session.refresh_token
                );
            }



            return { success: true, session: data.session };
        } catch (err: any) {
            return { success: false, error: err.message || "An unexpected error occurred" };
        }
    },
};