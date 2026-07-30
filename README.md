# Zean Fitness Mobile App — Architecture & Development Log

## Project Overview

The **Zean Fitness Mobile App** (VitaFit Club Manager) is a multi-tenant React Native Expo application built for fitness clubs and gym chains. The app supports dynamic property pairing via QR code scanning and provides two distinct, role-based user portals:

1. **Staff Portal (`/(staff)`)**: Tab-based interface for gym administrators, managers, and staff to handle check-ins, member lists, transactions, reports, and attendance.
2. **Client/Member Portal (`/(client)`)**: Stack-based interface for gym members to view digital access passes, personal workout activities, membership status, and bookings.

---

## Technology Stack

- **Framework**: Expo 54+ (React Native with New Architecture enabled)
- **Routing**: Expo Router (File-based routing with layout guards)
- **Database & Backend**: Supabase (PostgreSQL, Realtime, Auth, Edge Functions)
- **State & Data Fetching**: React Context API (`DatabaseContext`) + TanStack Query (`@tanstack/react-query`)
- **Secure Storage**: `expo-secure-store` (Encrypted local persistence for property config, member tokens, biometrics)
- **Icons & Feedback**: `lucide-react-native`, `react-native-toast-message`
- **Biometrics**: `expo-local-authentication`

---

## Overall Project Directory Structure

```text
├── app/
│   ├── (auth)/
│   │   └── login.tsx               # Dual-path login UI (Staff & Member authentication)
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
│   ├── BiometricSetup.tsx          # Biometric authentication handlers
│   └── ui/                         # Shared UI components (Avatars, Cards, Badges)
├── contexts/
│   └── DatabaseContext.tsx         # Central multi-tenant context, auth state, & database switch engine
├── hooks/
│   └── useAuth.ts                  # Auth hook wrapper and session refetch helper
├── libs/
│   └── supabase.ts                 # Dynamic Supabase client factory & auto-refresh state bindings
├── services/
│   └── configStorage.ts            # Expo SecureStore storage engine for property configurations
└── supabase/
    └── functions/
        └── create-member-jwt/      # Edge Function for member custom JWT issuance

```

---

## Core System Architecture

### 1. Dynamic Multi-Tenancy (Property QR Pairing)

To allow a single mobile app build to operate across different gym locations with isolated Supabase backend databases:

- **Dynamic Client Factory**: Supabase instances are instantiated dynamically at runtime via `createDynamicSupabaseClient(url, key)` in `libs/supabase.ts`.
- **Property Switch Protocol**: When switching properties, `setupProperty` purges local property keys, resets all React state, clears cached TanStack Query memory, and removes stored member session tokens.

```
 [QR Code Scan] ──► savePropertyConfig() ──► createDynamicSupabaseClient() ──► Rebind Listeners

```

---

### 2. Dual-Path Authentication Workflow

The authentication layer (`app/(auth)/login.tsx`) automatically detects whether the user is a staff member or club client:

```
                               ┌───────────────────────────┐
                               │   app/(auth)/login.tsx    │
                               └─────────────┬─────────────┘
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
  [PATH 1: STAFF AUTHENTICATION]                             [PATH 2: MEMBER / CLIENT AUTH]
  • Supabase Native Auth (`signInWithPassword`)              	• Lookup in `members` table by email & `member_code`
  • Verify role in `app_users` table                        	• Invoke Edge Function: `create-member-jwt`
  • Roles: admin, manager, staff, owner                      • Write token to `SecureStore` via `setMemberSession`
  • Route: `router.replace("/(staff)")`                      	• Decode JWT claims & assign `userRole = "client"`
                                                             • Route: `router.replace("/(client)")`

```

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

### Phase 4: Biometric Authentication Integration

- Integrated `expo-local-authentication` in `BiometricSetup.tsx`.
- Added biometric bypass capability on the login screen for previously authenticated users.

### Phase 5: Critical Bug Fixes & Reactivity Overhaul (Current)

- **Resolved Stale React State Bug**: Fixed issue where scanning a new property QR code left previous `user` state intact, erroneously routing users to `/(client)` with empty data instead of `/(auth)/login`.
- **Cross-Property Member Token Leak Fix**: Updated `setupProperty` and `resetProperty` in `DatabaseContext.tsx` to explicitly delete `vitafit_member_session` from `SecureStore` whenever a property is switched or unlinked.
- **TanStack Query Memory Purging**: Injected `queryClient.clear()` into `logout()`, `setupProperty()`, and `resetProperty()` to prevent query results from one property database leaking into another.
- **Context Integration (`setMemberSession`)**: Created and exported `setMemberSession` helper in `DatabaseContext.tsx` to combine token writing and state synchronization synchronously, eliminating missing re-renders upon client login.
- **Import Path Standardizations**: Resolved Metro bundler module resolution errors by standardizing relative imports for `libs/supabase.ts`.

---

## Context API Reference (`useDatabase`)

| Function / Value         | Type                      | Description                                                                                 |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------- |
| `supabase`               | `SupabaseClient` `null`   | Dynamic primary Supabase client instance.                                                   |
| `supabaseRead`           | `SupabaseClient` `null`   | Read-optimized Supabase client instance.                                                    |
| `user`                   | `User` `AuthUser` `null`  | Active authenticated user or member payload.                                                |
| `userRole`               | `"staff" "client"` `null` | Current permission level used by navigation guards.                                         |
| `config`                 | `PropertyConfig` `null`   | Currently paired property metadata (URL, keys, name).                                       |
| `setupProperty(config)`  | `Function`                | Pairs device to a new property, purges old sessions/caches, and updates state.              |
| `resetProperty()`        | `Function`                | Unlinks property, clears storage, resets query cache, and routes to `/setup`.               |
| `setMemberSession(data)` | `Function`                | Saves member JWT payload to `SecureStore` and updates context state immediately.            |
| `logout()`               | `Function`                | Signs out of Supabase, deletes stored member session, clears query cache, and resets state. |

---

## Setup & Running the Project

1. **Install Dependencies**:

`````bash
npm install````
2. **Start Development Server**:
````bash
npx expo start````

3. **Pair Property**:
   On launch, scan a valid property configuration QR code containing `supabaseUrl` and `supabasePublishableKey`. To switch properties later, click **Switch** on the login screen or navigate to settings.
`````
