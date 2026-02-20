

# Accounts & Sharing -- Phase 1: Database & Auth Foundation

## Overview
Sets up the database schema for auth-aware trip membership, updates signup to capture a display name, creates the invite join flow, and adds the new `useTripMember` hook. The old `useCurrentUser` system continues to work alongside -- Phase 2 will swap it out.

## Changes

### 1. Database Migrations (4 migrations)

**Migration 1 -- Add columns & indexes:**
- `trip_users.user_id` (UUID, FK to auth.users, nullable for existing rows)
- `trips.invite_code` (TEXT, UNIQUE)
- `entries.created_by` (UUID, FK to auth.users, ON DELETE SET NULL)
- Indexes on `trip_users(user_id)` and `trip_users(trip_id, user_id)`
- Backfill invite codes for existing trips

**Migration 2 -- Update `handle_new_user` trigger:**
- On signup, auto-create profile with `display_name` from `raw_user_meta_data`
- Uses ON CONFLICT to update if profile already exists

**Migration 3 -- Auto-generate invite code trigger:**
- `generate_invite_code()` function on `trips` BEFORE INSERT
- Sets `invite_code = substr(md5(random()), 1, 8)` if NULL

**Migration 4 -- RLS policies & helper functions:**
- Drop existing permissive "Anyone can..." policies on trips, entries, entry_options, trip_users, profiles
- Create `is_trip_member(trip_id)`, `is_trip_organiser(trip_id)`, `is_trip_editor(trip_id)` security definer functions
- New policies: trips (owner/member read, owner write), entries (member read, editor write), entry_options (via entry's trip_id), trip_users (member read, organiser manage, self-insert for invite flow), profiles (public read, self write)
- Special `trips_select_by_invite` policy for the join flow

### 2. Frontend Changes

**`src/hooks/useAdminAuth.ts`:**
- `signUp` accepts optional `displayName` parameter, passes it via `options.data.display_name`
- Replace `user_roles` insert on SIGNED_IN with `profiles` upsert (ensures profile exists)

**`src/pages/Auth.tsx`:**
- Add `name` state and Name input field (shown only during signup, with User icon)
- Import `useSearchParams` for redirect handling
- Pass `name` to `signUp(email, password, name.trim())`
- After login/signup, navigate to `redirectUrl || '/'` instead of hardcoded `/`

**`src/hooks/useTripMember.ts` (NEW):**
- Auth-aware hook that queries `trip_users` for current user's membership in a given trip
- Returns `member`, `loading`, `isAuthenticated`, `isOrganiser`, `isEditor`, `isViewer`, `refetch`
- Not wired into any pages yet (Phase 2)

**`src/pages/Invite.tsx` (NEW):**
- Route: `/invite/:code`
- If not logged in: redirect to `/auth?redirect=/invite/{code}`
- If logged in: look up trip by invite_code, check existing membership, join as viewer if new
- Shows loading spinner while joining, error message if invalid code

**`src/App.tsx`:**
- Add `/invite/:code` route pointing to new Invite page
- Replace `/trip/:tripId` UserSelect route with TripRedirect component (redirects authenticated users to timeline, unauthenticated to `/auth`)
- Import `useParams`, `useNavigate`, `useEffect` and `useAdminAuth` for TripRedirect

**`src/pages/TripWizard.tsx`:**
- Add `user_id: adminUser?.id ?? null` to the organizer's `trip_users` insert
- Other wizard-added members do NOT get user_id (they link when they join via invite)

## What does NOT change
- `useCurrentUser` hook -- still used everywhere, Phase 2 swaps it
- Timeline.tsx, EntrySheet.tsx, TimelineHeader.tsx, Live.tsx, Planner.tsx, Dashboard.tsx, TripSettings.tsx
- UserSelect.tsx is kept (just no longer routed to from `/trip/:tripId`)

## Technical Details

RLS helper functions use SECURITY DEFINER to avoid recursion:
```text
is_trip_member(trip_id) -- checks trip_users for auth.uid()
is_trip_organiser(trip_id) -- checks trip_users for auth.uid() + role='organizer'
is_trip_editor(trip_id) -- checks trip_users for auth.uid() + role IN ('organizer','editor')
```

Invite flow sequence:
```text
User clicks /invite/abc123
  -> Not logged in? Redirect to /auth?redirect=/invite/abc123
  -> Logged in? Look up trip by invite_code
    -> Already member? Redirect to timeline
    -> New? Insert trip_users row (self-insert allowed by RLS) -> Redirect to timeline
```

The `as any` cast on trip_users insert in TripWizard is needed because the generated types may not yet include `user_id` until types auto-sync.

## Files modified
| File | Change |
|------|--------|
| DATABASE | 4 migrations: columns, triggers, RLS policies |
| `src/hooks/useAdminAuth.ts` | display_name in signUp, profile upsert on sign-in |
| `src/pages/Auth.tsx` | Name field on signup, redirect param handling |
| `src/hooks/useTripMember.ts` | NEW -- auth-aware trip membership hook |
| `src/pages/Invite.tsx` | NEW -- invite link join flow |
| `src/App.tsx` | Add /invite/:code route, TripRedirect replaces UserSelect |
| `src/pages/TripWizard.tsx` | Add user_id to organiser trip_users insert |

