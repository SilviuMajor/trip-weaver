

# Toast Notifications — Compact, Below Nav, Shorter Duration

A single file update to make toast notifications more compact, positioned below the nav bar, and auto-dismiss faster.

---

## Changes

**File:** `src/components/ui/sonner.tsx`

Update the `Sonner` component props and toast class names:

- Add `position="top-center"` — toasts appear centered at top
- Add `offset={56}` — pushes toasts below the nav bar (56px)
- Add `duration={2000}` — auto-dismiss after 2 seconds (was default ~4s)
- Add `gap={4}` — tighter spacing between stacked toasts
- Update toast classNames to include `py-2 px-3 text-sm` for compact padding
- Update description classNames to include `text-xs` for smaller secondary text

No other files are affected.

