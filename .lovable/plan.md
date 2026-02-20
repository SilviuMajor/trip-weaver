

# Fix: Invite Links Should Use Published Domain

## Problem
The share link uses `window.location.origin` to build the URL. When you copy the link from the Lovable editor preview, it picks up the preview domain (`505eb05c-...lovableproject.com`) instead of your real published domain (`timelineplanner.lovable.app`). Anyone who receives that link gets sent to the Lovable preview, not your app.

## Solution
Replace `window.location.origin` with a constant pointing to your published domain for invite links. This ensures the link always points to your live app regardless of where you copy it from.

## Changes

### 1. `src/pages/TripSettings.tsx` (lines 113-115)
Replace `window.location.origin` in `handleCopyLink` and the displayed link text with the published URL:

```typescript
const PUBLISHED_URL = 'https://timelineplanner.lovable.app';

const url = trip?.invite_code
  ? `${PUBLISHED_URL}/invite/${trip.invite_code}`
  : `${PUBLISHED_URL}/trip/${tripId}`;
```

Same replacement in the displayed `<code>` element showing the link.

### 2. `src/pages/Dashboard.tsx` (lines 150-153)
Same change in `handleCopyLink`:

```typescript
const PUBLISHED_URL = 'https://timelineplanner.lovable.app';

const url = trip.invite_code
  ? `${PUBLISHED_URL}/invite/${trip.invite_code}`
  : `${PUBLISHED_URL}/trip/${trip.id}`;
```

### Optional: If you later connect a custom domain
You can update the single `PUBLISHED_URL` constant to your custom domain (e.g., `https://yourdomain.com`) and both pages will use it automatically.

## Files changed
| File | Change |
|------|--------|
| `src/pages/TripSettings.tsx` | Use published URL for invite links |
| `src/pages/Dashboard.tsx` | Use published URL for invite links |

