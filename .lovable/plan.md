

# Fix Trip Entry + Add Dashboard Trip Actions

## Problem 1: Can't Enter Your Trips

**Root cause:** Your trips have 0 members in the database. The wizard auto-adds you as an organizer member on creation, but this silently failed. When you visit a trip, the UserSelect page shows "No members yet" because there's nobody to select.

**Two-part fix:**

### A. Fix existing trips (data repair)
Insert the missing organizer member rows for your two trips so they work immediately.

### B. Auto-bypass for authenticated owner
When an authenticated admin visits `/trip/{tripId}` (UserSelect page), check if they're the trip owner. If so, auto-create their trip_user entry if missing and log them straight in -- no need to pick from a member list.

**Changes to `src/pages/UserSelect.tsx`:**
- Import `useAdminAuth` to detect if user is authenticated
- On load, check if authenticated user is the trip owner
- If owner and no matching trip_user exists, auto-insert one
- Auto-login as that member and redirect to timeline

---

## Problem 2: Settings Button Per Trip on Dashboard

Add a settings dropdown (three-dot menu) on each trip card with:
- **Trip Settings** -- navigates to `/trip/{tripId}/settings`
- **Copy Share Link** -- copies `{origin}/trip/{tripId}` to clipboard with a toast confirmation
- **Delete Trip** -- confirmation dialog, then deletes the trip from the database

**Changes to `src/pages/Dashboard.tsx`:**
- Add a `DropdownMenu` with three options on each trip card
- Copy share link uses `navigator.clipboard.writeText()`
- Delete uses an `AlertDialog` for confirmation, then calls `supabase.from('trips').delete().eq('id', trip.id)` and refreshes the list

---

## Files Summary

| File | Changes |
|------|---------|
| Database (data fix) | Insert missing organizer members for existing trips |
| `src/pages/UserSelect.tsx` | Auto-bypass for authenticated trip owner |
| `src/pages/Dashboard.tsx` | Add settings dropdown with settings/share/delete per trip card |

