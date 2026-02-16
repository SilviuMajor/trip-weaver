
# Flight Cards, Overview Sheet, and Transport Fixes

## Overview
Three targeted changes: modernize the flight card with diagonal fade, convert the entry overview from Dialog to Drawer with hero gallery, and fix transport connector layout bugs.

## 1. Transport Connector Fixes (`TransportConnector.tsx`)

### 1a. Fix strip width overflow
Change the background strip from `absolute inset-0` to explicit positioning with `right: 4` to match the card column's `pr-1` padding.

### 1b. Move from-to label below pill
Restructure the pill and from-to label into a single flex-column container so the label sits directly below the pill instead of being independently positioned (which causes overlap on short gaps). Remove the separate absolute-positioned from-to div (lines 268-276) and integrate it as a child of the pill's wrapper.

## 2. Flight Card Redesign (`FlightGroupCard.tsx`)

### 2a. Diagonal fade on main flight section
Replace the vertical gradient (`bg-gradient-to-t from-black/70 via-black/30`) with a diagonal fade overlay: `linear-gradient(155deg, transparent 22%, rgba(10,8,6,0.25) 32%, rgba(10,8,6,0.68) 42%, rgba(10,8,6,0.92) 52%)` (condensed tier formula, since flight sections are typically medium height).

### 2b. Glossy no-image fallback
Replace `background: ${catColor}22` with a dark glossy gradient using flight hue (210): `linear-gradient(145deg, hsl(210,22%,14%), hsl(210,10%,7%))` plus glass highlight overlay.

### 2c. Corner flag replaces badge pill
Remove the "Flight" text badge pill (lines 128-133). Add a top-left corner flag with just the plane emoji, styled with `borderRadius: '14px 0 8px 0'` and catColor background.

### 2d. Duration pill top-right
Add a frosted glass duration pill at top-right showing `flightDuration`, matching the EntryCard design.

### 2e. Left-aligned boarding pass content
Keep content LEFT-aligned (unlike regular cards which are right-aligned). Show flight name bold at bottom-left, route info below.

### 2f. Wrapper cleanup
- Change `rounded-2xl` to `rounded-[14px]`
- Remove `borderColor` and `borderLeftWidth: 4` from the wrapper style (line 90)
- Remove `border` class from wrapper
- Keep check-in/checkout bars with their current content but add `rounded-t-[14px]` to check-in and `rounded-b-[14px]` to checkout

## 3. Overview Sheet Redesign (`EntrySheet.tsx` VIEW MODE only)

### 3a. Dialog to Drawer conversion
Replace `<Dialog>` / `<DialogContent>` (lines 1214-1215, 1824-1825) with `<Drawer>` / `<DrawerContent>` from `@/components/ui/drawer`. Import Drawer components. Only affects view mode -- create mode stays as Dialog.

### 3b. Hero image gallery at top
Move ImageGallery from bottom (lines 1708-1711) to the very top of the drawer content, before the title. Make it full-width with no horizontal padding. Overlay the ImageUploader button on the gallery. Remove the standalone ImageGallery and ImageUploader renders from the bottom.

### 3c. Lock and Delete buttons
Move from absolute-positioned header buttons into a small icon row below the category badge and title.

### 3d. Remove DialogHeader
Replace with plain div since Drawer doesn't need DialogHeader wrapper.

### 3e. Budget section collapsible
Add a Budget collapsible section (currently missing from the view mode) below Notes, matching the same pattern.

## 4. ImageGallery Touch Swipe (`ImageGallery.tsx`)

### 4a. Add touch swipe support
Add `touchStart` state. On `onTouchStart`, record `clientX`. On `onTouchEnd`, calculate diff -- if >50px swipe left (next), if <-50px swipe right (prev).

### 4b. Wider aspect ratio
Change `aspect-[16/10]` to `aspect-[16/9]` for hero context.

## What does NOT change
- EntryCard.tsx (already redesigned)
- ContinuousTimeline.tsx (no changes needed)
- EntrySheet.tsx CREATE/EDIT modes
- SidebarEntryCard.tsx
- MapPreview.tsx (kept for use elsewhere, just not rendered standalone in overview)
- Any drag/interaction mechanics
- Database schema

## Files modified
| File | Scope |
|------|-------|
| `src/components/timeline/TransportConnector.tsx` | Strip right:4, from-to label below pill |
| `src/components/timeline/FlightGroupCard.tsx` | Diagonal fade, corner flag, duration pill, boarding pass layout |
| `src/components/timeline/EntrySheet.tsx` | Dialog to Drawer, hero gallery, button repositioning |
| `src/components/timeline/ImageGallery.tsx` | Touch swipe, wider aspect ratio |
