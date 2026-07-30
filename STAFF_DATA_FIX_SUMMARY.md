# Staff Data Invisibility - Fix Implementation Summary

## Overview
This document summarizes all fixes applied to resolve the staff data invisibility issue in the Zean Fitness Mobile App. The root causes were:
1. **RLS Recursion Deadlocks** - Policies checking `app_users` from within `app_users` queries
2. **Missing Auth Headers** - `supabaseRead` client not inheriting session tokens
3. **Static Query Keys** - Cache collisions preventing refetches
4. **Hardcoded Outlet Filters** - Admins blocked from seeing all outlets' data

---

## 1. SQL Migration (Run First)

**File:** `/workspace/supabase-rls-fix-migration.sql`

### What It Does:
- Creates `check_staff_role()` SECURITY DEFINER function to bypass RLS recursion
- Updates RLS policies on all tables (`app_users`, `members`, `attendance`, `check_ins`, `bookings`, `transactions`, `outlets`)
- Grants proper permissions to authenticated users

### How to Apply:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `supabase-rls-fix-migration.sql`
3. Paste and run
4. Verify no errors in output
5. Check "Policies" section in Table editor to confirm new policies exist

---

## 2. Client Auth Header Fix

**File:** `libs/supabase.ts` (Lines 65-94)

### Changes Made:
```typescript
// BEFORE: Read client had persistSession: false
const supabaseRead = createClient(replicaUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// AFTER: Read client now persists session and syncs with primary
const supabaseRead = createClient(replicaUrl, anonKey, {
  auth: {
    storage: MobileSecureStoreAdapter, // Use same secure storage
    persistSession: true,              // CRITICAL: Attaches Authorization header
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Sync session immediately on creation
supabase.auth.getSession().then(({  { session } }) => {
  if (session && supabaseRead) {
    supabaseRead.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }
});

// Listen for future token changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session && supabaseRead) {
    await supabaseRead.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }
});
```

### Why This Fixes It:
- RLS policies require `authenticated` role
- Without `persistSession: true`, GET requests send no `Authorization` header
- Supabase treats these as anonymous requests and RLS blocks them
- Now both clients share the same auth token

---

## 3. Staff Screen Refactors

All files in `app/(staff)/` updated with consistent patterns:

### A. Members Screen (`app/(staff)/members.tsx`)

**Changes:**
- Replaced static import `import { supabaseRead } from "@/libs/supabase"` 
- With context hook: `const { supabaseRead, config, activeUser } = useDatabase()`
- Added dynamic query key: `["staff-members", config?.supabaseUrl, staffOutletId, isAdmin]`
- Added flexible outlet scoping:
  ```typescript
  const isAdmin = ["admin", "owner", "superadmin", "manager"].includes(
    String(staffRole).toLowerCase()
  );
  
  if (!isAdmin && staffOutletId) {
    query = query.eq("outlet_id", String(staffOutletId));
  }
  ```
- Added `enabled: !!supabaseRead && !!config?.supabaseUrl` condition

### B. Reports Screen (`app/(staff)/reports.tsx`)

**Changes:**
- Same context hook pattern
- Applied flexible outlet scoping to ALL 4 queries:
  - Members count
  - Revenue aggregation
  - Bookings count
  - Check-ins count
- Dynamic query key includes `config?.supabaseUrl`

### C. Ledger Screen (`app/(staff)/ledger.tsx`)

**Changes:**
- Context hook instead of static import
- Dynamic query key with property URL and outlet ID
- Flexible outlet filtering for transactions

### D. Dashboard Screen (`app/(staff)/index.tsx`)

**Changes:**
- Removed deprecated `UIManager.setLayoutAnimationEnabledExperimental` call
- Removed unused `Platform` and `UIManager` imports
- Already had proper outlet scoping via `useOutlet()` context
- Query key already included `selectedOutlet?.id`

---

## 4. Verification Checklist

### Step 1: Apply SQL Migration
```sql
-- Run in Supabase SQL Editor
-- File: supabase-rls-fix-migration.sql
```
✅ No errors in output
✅ New policies visible in Supabase dashboard

### Step 2: Restart App
```bash
# Clear metro bundler cache
npx expo start --clear
```

### Step 3: Test Staff Login
1. Log in as staff member (any role)
2. Open Chrome DevTools → Network tab
3. Navigate to Members tab
4. Inspect request to `/rest/v1/members`
5. ✅ Verify `Authorization: Bearer eyJ...` header exists

### Step 4: Test Data Visibility
| Role | Expected Behavior |
|------|------------------|
| Admin/Owner | See ALL members from ALL outlets |
| Manager | See ALL members from ALL outlets |
| Staff (with outlet_id) | See ONLY members from their outlet |
| Staff (no outlet_id) | See NO members (edge case - should be assigned an outlet) |

### Step 5: Test Reports Dashboard
1. Navigate to Reports tab
2. Verify all 4 metrics show non-zero values (if data exists):
   - Total Members
   - Monthly Revenue
   - Total Bookings
   - Today's Check-Ins

### Step 6: Test Ledger
1. Navigate to Ledger tab
2. Verify transaction history appears
3. Pull down to refresh → Verify new data loads

### Step 7: Test Multi-Property Switch
1. If you have multiple properties configured:
2. Switch to different property via QR scan
3. Verify data clears and reloads for new property
4. Verify NO data from previous property appears

---

## 5. Common Issues & Troubleshooting

### Issue: Still seeing empty lists after fixes
**Check:**
1. Did you run the SQL migration? (Most common mistake)
2. Is the staff user's role correctly set in `app_users` table?
3. Check browser console for RLS errors: `"new row violates row-level security policy"`

### Issue: "No database connection" error
**Check:**
1. Is property configured? (QR code scanned?)
2. Check `config?.supabaseUrl` is not null
3. Try logging out and back in

### Issue: Admin can't see all outlets' data
**Check:**
1. Is user's role EXACTLY 'admin', 'owner', 'superadmin', or 'manager'? (case-sensitive)
2. Check `app_users.role` column value
3. Temporarily log the `isAdmin` variable to verify

### Issue: Network request shows 401 Unauthorized
**Check:**
1. Is Supabase anon key correct in QR code / config?
2. Is RLS enabled on the target table?
3. Does the policy include `FOR SELECT`?

---

## 6. Architecture Improvements Summary

| Before | After |
|--------|-------|
| Static Supabase imports | Context-based dynamic clients |
| Fixed query keys | Dynamic keys with property URL |
| Hardcoded outlet filters | Role-aware flexible scoping |
| Read client without auth | Read client inherits session |
| RLS recursion deadlocks | SECURITY DEFINER bypass function |
| Deprecated UIManager calls | Removed for New Architecture |

---

## 7. Files Modified

1. `libs/supabase.ts` - Auth header sync for read client
2. `app/(staff)/members.tsx` - Full refactor with context + scoping
3. `app/(staff)/reports.tsx` - Full refactor with context + scoping
4. `app/(staff)/ledger.tsx` - Full refactor with context + scoping
5. `app/(staff)/index.tsx` - Removed deprecated UIManager calls
6. `supabase-rls-fix-migration.sql` - NEW FILE: SQL migration script

---

## 8. Next Steps

1. **Apply SQL migration immediately** (required for other fixes to work)
2. Test all staff screens with different user roles
3. Monitor Sentry/error logs for any remaining RLS violations
4. Consider adding loading states that explain "No data" vs "Loading..."
5. Add automated tests for RLS policy behavior

---

## Support

If issues persist after applying all fixes:
1. Check Supabase Logs for RLS denial messages
2. Verify `auth.uid()` matches the logged-in user's ID
3. Test queries directly in Supabase SQL Editor using `SET ROLE authenticated;`
4. Ensure all tables have RLS enabled: `ALTER TABLE xxx ENABLE ROW LEVEL SECURITY;`
