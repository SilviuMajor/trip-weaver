

# Apply "Colourful & Playful" Style Across the App

## Overview

Transform the app's visual identity from the current neutral/warm-journal aesthetic to the bold, emoji-rich, rounded, warm-palette "Colourful & Playful" style shown in Style B on the showcase page.

## What Changes

### 1. Global Theme (CSS Variables) -- `src/index.css`

Update the CSS custom properties to use the warm, saturated palette:

| Token | Current | New (Colourful & Playful) |
|-------|---------|--------------------------|
| `--background` | Warm grey `40 33% 96%` | Warm cream `40 40% 97%` |
| `--card` | Near-white `40 30% 98%` | Light amber `38 60% 97%` |
| `--primary` | Orange `24 80% 50%` | Bold orange `24 90% 52%` |
| `--secondary` | Cool blue `200 60% 94%` | Warm peach `30 70% 92%` |
| `--muted` | Grey `35 20% 91%` | Warm sand `35 40% 90%` |
| `--border` | Grey `35 20% 87%` | Amber tint `35 45% 85%` |
| `--radius` | `0.75rem` | `1rem` (more rounded) |

Also update dark mode equivalents with warmer tones.

### 2. Entry Cards -- `src/components/timeline/EntryCard.tsx`

The biggest visual change. Transform from gradient-overlay cards to the playful style:

- Replace the full-bleed time-of-day gradient background with a **light category-tinted background** and a **bold left border** in the category colour
- Show the category **emoji large** (text-xl) next to the entry title
- Make cards `rounded-2xl` with `shadow-md`
- Time text uses the category colour instead of white
- Keep the image overlay style when a photo exists, but add more rounding
- Keep vote button but style it with rounder pills and warmer colours

### 3. Travel Segments -- `src/components/timeline/TravelSegmentCard.tsx`

Replace the dashed vertical border with the playful dashed-line-with-emoji style:

- Show a mode emoji (walking person, bus, etc.) on the left
- A dashed amber line stretching across
- Duration in a rounded amber pill on the right
- Remove the muted/subtle look, make it warmer

### 4. Timeline Day Headers -- `src/components/timeline/TimelineDay.tsx`

- Add a weather/sun emoji next to the day name (decorative, using the weather data if available)
- Show "X activities planned" subtitle below the date
- Warmer background tint for the sticky header
- Bolder typography with amber-900 for the day name

### 5. Timeline Header -- `src/components/timeline/TimelineHeader.tsx`

- Warm amber-tinted header background instead of neutral
- Round the action buttons more (`rounded-xl`)
- Use warmer icon colours (amber shades instead of grey muted)

### 6. Dashboard -- `src/pages/Dashboard.tsx`

- Trip cards: add a playful left border with a random warm colour, larger rounded corners (`rounded-2xl`)
- Show destination with a pin emoji
- Empty state: larger emoji, warmer colours
- Header: warm amber tint

### 7. Auth Page -- `src/pages/Auth.tsx`

- Warm cream background
- The MapPin icon wrapper uses a bolder amber background
- Form inputs get rounder corners and warmer borders
- Primary button stays bold orange with more rounding

### 8. User Select -- `src/pages/UserSelect.tsx`

- User avatars: colourful category-style backgrounds (rotating warm colours per user) instead of subtle primary/10
- Warmer card borders and hover states
- More rounded cards (`rounded-2xl`)

### 9. Entry Overlay -- `src/components/timeline/EntryOverlay.tsx`

- Category badge: larger, bolder, with emoji
- Warmer background for the sheet
- Rounder corners on all elements

### 10. Vote Button -- `src/components/timeline/VoteButton.tsx`

- Warmer colour palette: amber-200 background when not voted, bold primary when voted
- More rounded (`rounded-full` already, keep it)

### 11. Weather Badge -- `src/components/timeline/WeatherBadge.tsx`

- Warm amber-tinted background instead of neutral
- Slightly larger with bolder text

---

## Files Summary

| File | Changes |
|------|---------|
| `src/index.css` | Update CSS variables for warmer palette, increase border-radius |
| `src/components/timeline/EntryCard.tsx` | Playful card style with category tint, emoji, bold left border |
| `src/components/timeline/TravelSegmentCard.tsx` | Emoji + dashed amber line + duration pill |
| `src/components/timeline/TimelineDay.tsx` | Warmer day header, activity count subtitle |
| `src/components/timeline/TimelineHeader.tsx` | Warm amber-tinted header styling |
| `src/components/timeline/EntryOverlay.tsx` | Warmer tones, rounder elements |
| `src/components/timeline/VoteButton.tsx` | Amber-tinted inactive state |
| `src/components/timeline/WeatherBadge.tsx` | Warm amber badge background |
| `src/pages/Dashboard.tsx` | Playful trip cards with coloured borders |
| `src/pages/Auth.tsx` | Warm cream styling |
| `src/pages/UserSelect.tsx` | Colourful user avatar backgrounds |

## What Stays the Same

- All functionality, database logic, and routing remain unchanged
- The DM Sans body font and Playfair Display heading font stay (they fit the playful style well)
- The time-of-day gradient logic is kept but only used when no category colour is available
- Dark mode gets equivalent warm-dark adjustments

