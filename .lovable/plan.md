
# Accounts & Sharing -- Phase 2: Frontend Migration

## Overview
Swap every page from the old localStorage guest system (`useCurrentUser`) to real Supabase auth (`useTripMember`/`useAdminAuth`), update Dashboard to show shared trips, update TripSettings with invite links, and delete the old files.

## Changes

### 1. `src/pages/Timeline.tsx` -- Replace useCurrentUser with useTripMember
- Replace `useCurrentUser` import with `useTripMember` and `useAdminAuth`
- Replace `const { currentUser, isEditor } = useCurrentUser()` with destructured `useTripMember(tripId)` and `useAdminAuth()`
- Replace auth guard (lines 256-261) to check `memberLoading`, `isAuthenticated`, and `currentUser`
- Add `created_by: session?.user?.id ?? null` to all entry insert calls:
  - Line 369: `handleAddToPlanner` unscheduled entry insert
  - Line 442: `handleAddAtTime` scheduled entry insert
  - Line 879: transport entry insert in `autoGenerateTransport`

### 2. `src/components/timeline/TimelineHeader.tsx` -- Replace useCurrentUser
- Replace import with `useTripMember`, `useAdminAuth`, and `useParams`
- Get `paramTripId` from `useParams`, use `paramTripId || tripId` as `effectiveTripId`
- Replace `const { currentUser, logout, isOrganizer }` with `useTripMember(effectiveTripId)` destructured as `{ member: currentUser, isOrganiser: isOrganizer }` and `useAdminAuth()` for `signOut`
- Update `handleLogout` to call `await signOut()` and navigate to `/auth`

### 3. `src/components/timeline/EntrySheet.tsx` -- Replace useCurrentUser
- Replace import with `useTripMember` and `useAdminAuth`
- Replace `const { currentUser, isEditor } = useCurrentUser()` with `useTripMember(tripId)` and `useAdminAuth()`
- Add `created_by: session?.user?.id ?? null` to entry inserts:
  - Line 610: `handleSaveAsIdea` insert
  - Line 667-670: `handleSave` new entry insert
  - Line 734: flight checkin linked entry insert
  - Line 755: flight checkout linked entry insert

### 4. `src/pages/Live.tsx` -- Replace useCurrentUser
- Replace import with `useTripMember`
- `tripId` is already from `useParams`, so use `useTripMember(tripId)` to get `member: currentUser`
- Remove the duplicate `useParams` since it's already declared
- Update auth guard to redirect to `/auth` if not authenticated

### 5. `src/pages/Planner.tsx` -- Replace useCurrentUser
- Replace import with `useTripMember` and `useAdminAuth`
- Replace `const { currentUser, isEditor } = useCurrentUser()` with `useTripMember(tripId)` and `useAdminAuth()`
- Update auth guard (line 41-43) to check `!currentUser && !session`
- Add `created_by: session?.user?.id ?? null` to entry insert at line 125

### 6. `src/pages/TripWizard.tsx` -- Add created_by to entry inserts
- `adminUser` is already available. Add `created_by: adminUser?.id ?? null` to all entry inserts:
  - Line 100: `createFlightEntry` main flight entry
  - Line 124: checkin processing entry
  - Line 150: checkout processing entry
  - Lines 219-228: `createHotelEntries` hotel block entries
  - Line 308: `createPlannerEntries` activity entries

### 7. `src/pages/Dashboard.tsx` -- Show shared trips + invite links
- Add state: `tripOrganisers` and `memberRoleMap` (both `Record<string, string>`)
- Replace trips query in `fetchTrips` (lines 54-59):
  1. Query `trip_users` for all trips where `user_id = adminUser.id`
  2. Build roleMap from memberships
  3. Query `trips` with `.or()` filter for owned OR member trips
- After setting trips, fetch organiser names from `profiles` for shared trips
- Add "Organised by {name}" label before the date line in trip cards
- Update `handleCopyLink` to accept a trip object, use `invite_code` for the URL
- Update call site in dropdown to pass the full trip object

### 8. `src/pages/TripSettings.tsx` -- Invite link + member management
- **Share link**: Update `handleCopyLink` and displayed URL to use `trip?.invite_code` when available
- **Remove PIN management**: Delete the entire PIN section (lines 451-482) from each member row
- **Replace add-by-name form**: Replace the "Add member" form (lines 490-509) with a message: "Share the invite link above to add people to this trip."
- **Remove unused state**: `newMemberName`, `newMemberRole`, `addingMember`, and `handleAddMember`
- **Guard organiser row**: For `m.role === 'organizer'`, show "Organiser" label instead of role dropdown and remove button. Remove "Organizer" from the role select options for other members.
- Remove unused imports: `Plus`, `Lock`, `LockOpen`

### 9. `src/pages/GlobalPlanner.tsx` -- Phase 3 changes (already partially applied)
- Rename header from "My Places" to "Global Planner" (line 308)
- Replace trip query (lines 110-116) with membership-based query via `trip_users`
- Build `tripNameMap` from trips result
- Add `source_trip_name` to each place object
- Show trip attribution in city category view and unsorted places list

### 10. Delete old files
- Delete `src/pages/UserSelect.tsx`
- Delete `src/hooks/useCurrentUser.ts`
- Remove any remaining `UserSelect` import from `App.tsx` (already replaced with TripRedirect in Phase 1)

## What does NOT change
- `ContinuousTimeline.tsx` -- receives `isEditor` as a prop
- `EntryCard.tsx` -- no auth concerns
- Edge functions -- bypass RLS
- Drag/resize/weather systems
- Wizard steps (FlightStep, HotelStep, ActivitiesStep)

## Technical Details

The migration follows a consistent pattern for each file:
```text
1. Replace useCurrentUser import -> useTripMember + useAdminAuth
2. Destructure: { member: currentUser, isEditor } = useTripMember(tripId)
3. Get session from useAdminAuth for created_by
4. Update auth guards to check isAuthenticated + membership
5. Add created_by: session?.user?.id ?? null to entry inserts
```

Dashboard shared trips query:
```text
1. Get trip IDs from trip_users where user_id = me
2. Query trips with: owner_id = me OR id IN (member trip IDs)
3. For non-owned trips, fetch owner profiles for "Organised by X" label
```

TripSettings invite link format:
```text
{origin}/invite/{trip.invite_code}  (if invite_code exists)
{origin}/trip/{tripId}              (fallback)
```

## Files modified
| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | useTripMember, auth guard, created_by on inserts |
| `src/components/timeline/TimelineHeader.tsx` | useTripMember, real sign-out |
| `src/components/timeline/EntrySheet.tsx` | useTripMember, created_by on inserts |
| `src/pages/Live.tsx` | useTripMember |
| `src/pages/Planner.tsx` | useTripMember, created_by on inserts |
| `src/pages/TripWizard.tsx` | created_by on entry inserts |
| `src/pages/Dashboard.tsx` | Shared trips, organiser labels, invite link copy |
| `src/pages/TripSettings.tsx` | Invite link, remove PINs, remove add-by-name, guard organiser row |
| `src/pages/GlobalPlanner.tsx` | Rename header, query by membership, trip attribution |
| `src/pages/UserSelect.tsx` | DELETE |
| `src/hooks/useCurrentUser.ts` | DELETE |
