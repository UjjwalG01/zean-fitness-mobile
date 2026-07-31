This revision reflects all recent architectural enhancements, including the shift to **token-based biometric authentication**, the creation of `MemberBiometricService`, the addition of the 7-second `withTimeout` execution guards, and the resolution of OS-overlay lifecycle state issues.

---

# Zean Fitness Mobile App — Architecture & Development Log

## Project Overview

The **Zean Fitness Mobile App** (VitaFit Club Manager) is a multi-tenant React Native Expo application built for fitness clubs and gym chains. The app supports dynamic property pairing via QR code scanning and provides two distinct, role-based user portals:

1. **Staff Portal (`/(staff)`)**: Tab-based interface for gym administrators, managers, and staff to handle check-ins, member lists, transactions, reports, and attendance.
2. **Client/Member Portal (`/(client)`)**: Stack-based interface for gym members to view digital access passes, personal workout activities, membership status, and bookings.

---

## Technology Stack

- **Framework**: Expo 54+ (React Native with New Architecture enabled)
- **Routing**: Expo Router (File-based routing with layout guards)
- **Database & Backend**: Supabase (PostgreSQL, Realtime Auth, Edge Functions)
- **State & Data Fetching**: React Context API (`DatabaseContext`) + TanStack Query (`@tanstack/react-query`)
- **Secure Storage**: `expo-secure-store` (Encrypted hardware-backed local persistence for property configs, member tokens, and biometrics)
- **Icons & Feedback**: `lucide-react-native`, `react-native-toast-message`
- **Biometrics**: `expo-local-authentication`

---

## Overall Project Directory Structure

```text
├── app/
│   ├── (auth)/
│   │   └── login.tsx               # Dual-path login UI with token-based biometric auto-prompt
│   ├── (staff)/                    # Staff Portal (Tab-based Layout)
│   │   ├── _layout.tsx             # Staff tab bar configuration
│   │   ├── index.tsx               # Staff Dashboard
│   │   ├── attendance.tsx          # Member check-in & scanner
│   │   ├── members.tsx             # Member management
│   │   ├── transactions.tsx        # Payment & billing records
│   │   └── reports.tsx             # Club analytics & summaries
│   ├── (client)/                   # Client / Member Portal (Stack-based Layout)
│   │   ├── _layout.tsx             # Client stack configuration
│   │   ├── index.tsx               # Client Dashboard & Overview
│   │   ├── pass.tsx                # Digital Membership Pass / QR Code
│   │   └── activities.tsx          # Class bookings & activity log
│   ├── setup.tsx                   # Property QR code pairing screen
│   └── _layout.tsx                 # Root layout with DatabaseProvider & QueryClientProvider
├── components/
│   ├── BiometricSetup.tsx          # Biometric settings toggle component with timeout protection
│   └── ui/                         # Shared UI components (Avatars, Cards, Badges)
├── contexts/
│   └── DatabaseContext.tsx         # Central multi-tenant context, auth state, & database switch engine
├── hooks/
│   └── useAuth.ts                  # Auth hook wrapper and session refetch helper
├── libs/
│   └── supabase.ts                 # Dynamic Supabase client factory & auto-refresh state bindings
├── services/
│   ├── configStorage.ts            # SecureStore storage engine for property configurations
│   └── memberBiometricService.ts   # Centralized token-based biometric authentication service
└── supabase/
    └── functions/
        └── create-member-jwt/      # Edge Function for member custom JWT issuance

```

---

## Core System Architecture

### 1. Dynamic Multi-Tenancy (Property QR Pairing)

To allow a single mobile app build to operate across different gym locations with isolated Supabase backend databases:

- **Dynamic Client Factory**: Supabase instances are instantiated dynamically at runtime via `createDynamicSupabaseClient(url, key)` in `libs/supabase.ts`.
- **Property Switch Protocol**: When switching properties, `setupProperty` purges local property keys, resets all React state, clears cached TanStack Query memory, removes stored member session tokens, and disables local biometric configuration to prevent cross-property data leaks.

```text
 [QR Code Scan] ──► savePropertyConfig() ──► createDynamicSupabaseClient() ──► Rebind Listeners

```

---

### 2. Dual-Path Authentication Workflow

The authentication layer (`app/(auth)/login.tsx`) automatically detects whether the user is a staff member or club client:

```text
                               ┌───────────────────────────┐
                               │   app/(auth)/login.tsx    │
                               └─────────────┬─────────────┘
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
 [PATH 1: STAFF AUTHENTICATION]                             [PATH 2: MEMBER / CLIENT AUTH]
 • Supabase Native Auth (`signInWithPassword`)                • Lookup in `members` table by email & `member_code`
 • Verify role in `app_users` table                            • Invoke Edge Function: `create-member-jwt`
 • Roles: admin, manager, staff, owner                        • Write token to `SecureStore` via `setMemberSession`
 • Route: `router.replace("/(staff)")`                         • Decode JWT claims & assign `userRole = "client"`
                                                              • Route: `router.replace("/(client)")`

```

---

### 3. Secure Refresh-Token Biometric Architecture

Instead of storing raw passwords or sensitive credentials in local storage (which risk exposure and break if a password is changed), the app uses a **refresh-token architecture** powered by `MemberBiometricService`:

```text
 [Biometric Setup] ──► Read active Supabase Session ──► Get `refresh_token` ──► Encrypt in SecureStore
                                                                                      │
                                                                                      ▼
 [Login Screen] ◄── Verify Fingerprint/FaceID ◄── Retrieve `refresh_token` ◄── Hardware Prompt
        │
        └─► supabase.auth.refreshSession({ refresh_token }) ─► Issued fresh JWT ─► Route to /(client)

```

- **Zero Plaintext Credentials**: Plaintext passwords and member codes are **never** written to disk.
- **Biometric Enrolment**: When enabled in settings, active `refresh_token`s are saved in hardware-backed `SecureStore`.
- **Session Restoration**: Biometric verification exchanges the stored `refresh_token` with Supabase Auth via `refreshSession()`, returning a fresh JWT session.
- **Hang & Blur Protection**: All biometric operations are wrapped in a 7-second `withTimeout` (`Promise.race`) utility. This prevents native OS biometric prompts or storage locks from trapping the UI in an infinite loading state during application blur/focus events.

---

## Comprehensive Development & Architectural Changelog

### Phase 1: Initial Setup & File-Based Routing

- Established Expo Router file-based structure separating `/(staff)` tab routes and `/(client)` stack routes.
- Implemented static Supabase Auth authentication flow for gym employees.

### Phase 2: Dynamic Multi-Tenancy & Property QR Scanning

- Introduced `services/configStorage.ts` utilizing `expo-secure-store` to persist property parameters (`supabaseUrl`, `supabasePublishableKey`, `propertyName`).
- Replaced static Supabase import singleton with dynamic client creation in `DatabaseContext.tsx`.
- Created `/setup` QR scanner screen allowing device configuration per location.

### Phase 3: Dual-Path Authentication & Member Custom JWTs

- Implemented Edge Function `create-member-jwt` to issue custom access tokens for gym members without requiring full Supabase Auth user accounts.
- Updated `login.tsx` to attempt staff login first via Supabase Auth, gracefully falling back to client credential validation against the `members` database table.
- Added `SecureStore` key `vitafit_member_session` to persist member sessions locally with automatic expiration checks using `jwt-decode`.

### Phase 4: Token-Based Biometric Overhaul & Timeout Management

- **Token-Based Migration**: Replaced password/member code local storage with `refresh_token` session persistence in `SecureStore`.
- **Centralized Service Architecture**: Created `services/memberBiometricService.ts` to manage hardware checks, token storage, session restoration, and biometric wipe procedures.
- **Login Screen Refactor**: Updated `app/(auth)/login.tsx` to utilize `MemberBiometricService.authenticateMemberWithBiometrics(supabase)` with single-prompt guards (`hasPromptedBio`, `isAuthenticatingRef`) and manual trigger support. Removed all legacy password-replay logic (`tryBiometricAutoLogin`).
- **Settings Screen Refactor**: Streamlined `BiometricSetup.tsx` by removing password prompt modals and directly retrieving active session `refresh_token`s from `supabase.auth.getSession()`.
- **Execution Safeguards (`withTimeout`)**: Wrapped native OS biometric prompts and `SecureStore` reads in a 7-second `Promise.race` timeout to eliminate hung promises.
- **Lifecycle & Blur Handling**: Resolved an issue where native OS biometric prompts triggered React Native blur events that flipped `isMountedRef.current` to `false` and locked loading state spinners. Enforced unconditional `setIsProcessing(false)` inside `finally` blocks.

### Phase 5: Critical Bug Fixes & Reactivity Overhaul

- **Resolved Stale React State Bug**: Fixed issue where scanning a new property QR code left previous `user` state intact, erroneously routing users to `/(client)` with empty data instead of `/(auth)/login`.
- **Cross-Property Member Token Leak Fix**: Updated `setupProperty` and `resetProperty` in `DatabaseContext.tsx` to explicitly delete `vitafit_member_session` and biometric tokens from `SecureStore` whenever a property is switched or unlinked.
- **TanStack Query Memory Purging**: Injected `queryClient.clear()` into `logout()`, `setupProperty()`, and `resetProperty()` to prevent query results from one property database leaking into another.
- **Context Integration (`setMemberSession`)**: Created and exported `setMemberSession` helper in `DatabaseContext.tsx` to combine token writing and state synchronization synchronously, eliminating missing re-renders upon client login.

---

## Service API Reference

### `MemberBiometricService` (`services/memberBiometricService.ts`)

| Method                               | Parameters                            | Return Type                                     | Description                                                                       |
| ------------------------------------ | ------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `isHardwareAvailable()`              | None                                  | `Promise<boolean>`                              | Checks if device supports biometrics and has enrolled hardware records.           |
| `isMemberBiometricsEnabled()`        | None                                  | `Promise<boolean>`                              | Checks if member biometrics toggle is active in `SecureStore`.                    |
| `enableMemberBiometrics()`           | `refreshToken: string, email: string` | `Promise<boolean>`                              | Prompts OS biometrics and securely saves the `refresh_token`.                     |
| `disableMemberBiometrics()`          | None                                  | `Promise<void>`                                 | Clears biometric state and wipes stored refresh tokens from `SecureStore`.        |
| `authenticateMemberWithBiometrics()` | `supabase: SupabaseClient`            | `Promise<{ success: boolean, error?: string }>` | Prompts OS biometrics, reads `refresh_token`, and restores Supabase auth session. |

---

## Context API Reference (`useDatabase`)

| Function / Value         | Type            | Description                                                                                 |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `supabase`               | `SupabaseClient | null`                                                                                       | Dynamic primary Supabase client instance.             |
| `supabaseRead`           | `SupabaseClient | null`                                                                                       | Read-optimized Supabase client instance.              |
| `user`                   | `User           | AuthUser                                                                                    | null`                                                 | Active authenticated user or member payload.        |
| `userRole`               | `"staff"        | "client"                                                                                    | null`                                                 | Current permission level used by navigation guards. |
| `config`                 | `PropertyConfig | null`                                                                                       | Currently paired property metadata (URL, keys, name). |
| `setupProperty(config)`  | `Function`      | Pairs device to a new property, purges old sessions/caches, and updates state.              |
| `resetProperty()`        | `Function`      | Unlinks property, clears storage, resets query cache, and routes to `/setup`.               |
| `setMemberSession(data)` | `Function`      | Saves member JWT payload to `SecureStore` and updates context state immediately.            |
| `logout()`               | `Function`      | Signs out of Supabase, deletes stored member session, clears query cache, and resets state. |

---

## Setup & Running the Project

1. **Install Dependencies**:

```bash
npm install

```

2. **Start Development Server**:

```bash
npx expo start

```

3. **Pair Property**:
   On launch, scan a valid property configuration QR code containing `supabaseUrl` and `supabasePublishableKey`. To switch properties later, click **Switch** on the login screen or navigate to settings.
