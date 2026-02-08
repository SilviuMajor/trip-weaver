

# 🗺️ Trip Planner — Collaborative Itinerary App

## Overview
A visual, swipeable trip planning app where you build a day-by-day itinerary and share it with friends. Friends can browse, vote on options, and see how far they are from each activity — all from a beautiful, image-rich timeline.

---

## 🧑‍💼 User System (Simple, No Passwords)

- **You (Organizer)** create the trip and pre-register friend names in the backend
- Friends visit the app and select their name from a list to enter — no login/password required
- You can grant **Editor** permissions to any user (trip-wide), allowing them to add/edit entries
- Everyone else is **Viewer** — can browse and vote only

---

## 📅 Timeline View (Core Experience)

- **Vertical scrolling timeline**, one day flows into the next
- Trip has a defined **start and end date**
- **Pinch-to-zoom**: two fingers zoom in (15-minute slots at most zoomed in) or out (full day view at most zoomed out)
- A **"Today" quick-jump button** to snap back to the current day
- **Past entries are greyed out** but remain visible in the timeline
- **Dual timezone toggle** (UK ↔ Amsterdam) — a global switch that converts all displayed times

---

## 🗂️ Entry Cards

Each entry appears as a **compact card** on the timeline showing:
- **Background image** (first uploaded image by default)
- **Name/Place** title
- **Custom category** label (color-coded, one per entry — e.g. "Travel", "Food", "Chill", or anything custom)
- **Time range** (start → end)
- **Distance** from your current location (e.g. "2.3 km away")
- **Vote count indicator** (if multiple options exist)

### Expanded Overlay View
Tapping a card opens a **full overlay** with:
- All uploaded **images** (reorderable, first one = card background)
- **Name/Place**
- **Website** link
- **Location pin** with a small map preview + link to Apple Maps / Google Maps
- Category & time details
- Distance from current location

---

## 🔀 Multiple Options per Time Slot

- Any time slot can have **multiple competing options** (e.g. "Restaurant A" vs "Restaurant B")
- **Swipe left/right** on a card to browse the different options
- Each option has its **own images, name, location, website**, etc.
- Options are **ordered by vote count** (highest first)
- Non-winning options stay visible but appear after the top-voted one

---

## 🗳️ Voting System

- All viewers and editors can **vote on options** within a time slot
- Votes are **anonymous** — no one sees who voted for what, just tallies
- **Lock Voting toggle** (organizer/admin only) — hides the vote button for all users when activated
- Real-time vote tallies visible to everyone

---

## 📍 Live Location & Distance

- App requests your **current location** on load
- Every entry card shows **distance from you** to that activity's location
- Shown on **all entries** (past and future)
- Graceful fallback if location permission is denied (distance simply not shown)

---

## 🏷️ Custom Categories

- Categories are **custom text** you type in (not a fixed list)
- Each category gets a **color** (auto-assigned or chosen)
- Displayed as a **label/tag on the card**
- One category per entry

---

## 🖼️ Images

- Upload from **camera roll**
- Multiple images per entry/option
- **Reorderable** — drag to change order, first image becomes the card background
- Each option within a time slot has its **own set of images**

---

## 🔧 Backend (Lovable Cloud + Supabase)

The app needs a backend to support:
- **Database**: Trips, entries, options, votes, users, categories, permissions
- **Image storage**: Uploaded photos stored in Supabase Storage
- **Real-time updates**: Friends see vote changes and new entries live
- **Location data**: Stored per entry for distance calculations

---

## 📱 Pages & Navigation

1. **User Select Screen** — Pick your name from the list to enter
2. **Trip Timeline** — The main scrollable, zoomable itinerary view
3. **Entry Overlay** — Expanded detail view of any entry (slides up over timeline)
4. **Admin Controls** (organizer only) — Manage users, permissions, lock voting

---

## 🚀 Build Phases

### Phase 1 — Foundation
- User selection screen (name-based entry)
- Trip timeline with vertical scroll and day sections
- Basic entry cards with name, time, category
- Start/end date for the trip

### Phase 2 — Rich Entries
- Entry overlay with full details (images, website, location, map preview)
- Image upload from camera roll with reordering
- Custom color-coded categories
- Timezone toggle (UK ↔ Amsterdam)

### Phase 3 — Options & Voting
- Multiple options per time slot with swipe navigation
- Anonymous voting system
- Auto-reorder by vote count
- Lock voting toggle for admin

### Phase 4 — Location & Polish
- Live location tracking with distance display on all cards
- Pinch-to-zoom on timeline
- Past entry greying
- "Today" quick-jump button
- Editor permissions management
- Real-time sync across users

