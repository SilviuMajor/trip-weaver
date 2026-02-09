

# Comprehensive Update: Bug Fix, Account Profiles, Trip Settings, Entry Editing, and Style Showcase

## Overview

This plan covers 6 areas based on your choices:

1. **Bug fix** -- the duplicate name constraint on trip members
2. **Account display name** -- stored in a profiles table, editable in settings
3. **Auto-add creator as member** -- using their display name (or prompting for one)
4. **Trip settings page** -- rename trip, copy share link, manage members
5. **Entry edit and delete** -- full editing of entries from the timeline
6. **Style showcase page** -- a standalone page showing 3 visual style options side by side

---

## 1. Database Bug Fix: `trip_users_name_key`

The `trip_users` table currently has `UNIQUE (name)` globally, meaning no two members across ANY trip can share a name. This needs to become a composite unique constraint on `(trip_id, name)`.

**Migration:**
- Drop the existing `trip_users_name_key` constraint
- Add a new composite unique constraint on `(trip_id, name)`

---

## 2. Account Profiles + Display Name

Create a `profiles` table so authenticated users can store a display name. This name is used when auto-adding the creator as a trip member.

**Migration:**
- Create `profiles` table with columns: `id` (UUID, references auth.users), `display_name` (text, nullable), `created_at`, `updated_at`
- Enable RLS with policies for users to read/update their own profile
- Add a trigger that auto-creates a profile row on user signup (via a database function on `auth.users` insert -- using a trigger on the profiles table itself to auto-populate from auth metadata)

**New files:**
- `src/pages/Settings.tsx` -- Account settings page with display name input field and save button
- Route added in `App.tsx`: `/settings`

**Changes:**
- `src/hooks/useAdminAuth.ts` -- After sign-in, fetch the user's profile to get their display name
- `src/pages/Dashboard.tsx` -- Add a settings icon/link in the header, show display name instead of email when available

---

## 3. Auto-Add Creator as Trip Member

When creating a trip, the creator is automatically added to `trip_users` as an "organizer" member.

**Changes to `src/pages/TripWizard.tsx`:**
- After inserting the trip, also insert a `trip_users` row for the creator
- Use their `display_name` from their profile
- If no display name is set yet, prompt for one (a simple input field at the top of the Members step, pre-labelled "Your name on this trip")
- The creator row uses role "organizer"
- The creator appears in the members list but cannot be removed

---

## 4. Trip Settings Page

A dedicated settings page for each trip, accessible from a gear icon in the timeline header.

**New file: `src/pages/TripSettings.tsx`**
Contains:
- **Rename trip** -- editable text input for the trip name with a save button
- **Share link** -- displays the trip URL (`/trip/:tripId`) with a "Copy" button
- **Members list** -- shows current members with their roles; organizer can remove members or change roles
- **Back button** to return to timeline

**Route:** `/trip/:tripId/settings`

**Changes:**
- `src/components/timeline/TimelineHeader.tsx` -- Add a gear/settings icon button (visible to organizers) linking to `/trip/:tripId/settings`
- `src/App.tsx` -- Add route for `/trip/:tripId/settings`

---

## 5. Entry Edit and Delete

Add the ability to edit or delete entries from the entry overlay (the bottom sheet that appears when tapping a card).

**Changes to `src/components/timeline/EntryOverlay.tsx`:**
- Add an "Edit" button and "Delete" button (visible to editors/organizers)
- Delete: confirm via alert dialog, then delete the entry from the database and refresh
- Edit: opens a pre-filled edit form (reuses EntryForm in edit mode)

**Changes to `src/components/timeline/EntryForm.tsx`:**
- Accept an optional `editEntry` prop (existing entry data)
- When editing: pre-fill all fields, change the submit action to `update` instead of `insert`
- When editing: allow changing the date, start/end time
- Title changes from "New Entry" to "Edit Entry"

**Changes to `src/components/timeline/OptionForm.tsx`:**
- Accept optional `editOption` prop for editing existing options
- Pre-fill all fields when editing
- Submit uses `update` instead of `insert`

---

## 6. Style Showcase Page

A standalone page at `/styles` that displays 3 side-by-side example timeline cards in different visual styles, so you can see them and pick your favourite.

**New file: `src/pages/StyleShowcase.tsx`**

The page shows 3 columns (or stacked on mobile), each with:
- A title ("Clean & Minimal", "Colourful & Playful", "Dark & Modern")
- A mock day header
- 2-3 mock entry cards rendered in that style
- A mock travel segment between cards

Each style applies its own CSS variables/classes scoped to that column:

| Style | Characteristics |
|-------|----------------|
| **Clean & Minimal** | White/light grey backgrounds, thin borders, no gradients on cards, system font, subtle shadows, small monochrome category pills |
| **Colourful & Playful** | Bold category-coloured card backgrounds, large emojis, rounded shapes, playful shadows, warm saturated palette |
| **Dark & Modern** | Dark backgrounds, glassmorphism (blur + transparency), subtle gradient borders, neon-accent category badges, cool-toned palette |

**Route:** `/styles` added to `App.tsx`

This page is purely visual -- no database interaction. It uses hardcoded mock data to render the cards.

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Fix name constraint, create profiles table |
| `src/pages/Settings.tsx` | Create | Account settings with display name |
| `src/pages/TripSettings.tsx` | Create | Trip rename, share link, member management |
| `src/pages/StyleShowcase.tsx` | Create | 3-column visual style comparison |
| `src/App.tsx` | Edit | Add 3 new routes |
| `src/pages/TripWizard.tsx` | Edit | Auto-add creator as member |
| `src/pages/Dashboard.tsx` | Edit | Settings link, show display name |
| `src/hooks/useAdminAuth.ts` | Edit | Fetch profile display name |
| `src/components/timeline/TimelineHeader.tsx` | Edit | Add settings gear icon |
| `src/components/timeline/EntryOverlay.tsx` | Edit | Add edit/delete buttons |
| `src/components/timeline/EntryForm.tsx` | Edit | Support edit mode |
| `src/components/timeline/OptionForm.tsx` | Edit | Support edit mode |
| `src/components/wizard/MembersStep.tsx` | Edit | Show creator as locked first member |

