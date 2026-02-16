

# Fix: Text/pill overlap and rounded corners on short cards

## Bug 1: Text overlapping duration pill

After auditing the code, the `right: 54` on content divs (lines 576, 596) and `right: 5` on the pill (line 323) are correctly set in the inline styles. However, the issue may be that the pill's `right: 5` uses a pixel value without `px` suffix in the style object -- this is actually fine in React. The positioning values are correct.

To be safe, I will verify and ensure the values are explicitly applied and not overridden by any className.

## Bug 2: Rounded corners disappear (confirmed)

This is the main visual bug. In `cardBase` (lines 520-552), the image and fade gradient layers are direct children of the outer wrapper div. When `overflow-visible` is applied for short entries, the image/fade bleed past the rounded corners since nothing clips them.

**Fix**: Add an inner clipping container (`absolute inset-0 overflow-hidden rounded-[14px]`) that wraps ONLY the image and fade layers. The outer wrapper can then be `overflow-visible` without affecting background rendering.

### Current structure (broken)
```text
Outer div (overflow-visible on short cards, rounded-[14px])
  +-- img (bleeds past corners!)
  +-- fade gradient (bleeds past corners!)
  +-- children (text, pill, flag)
```

### Fixed structure
```text
Outer div (overflow-visible on short cards, rounded-[14px])
  +-- Inner div (overflow-hidden rounded-[14px], absolute inset-0)
  |     +-- img (clipped to rounded corners)
  |     +-- fade gradient (clipped to rounded corners)
  +-- children (text, pill, flag -- can overflow)
```

## Changes

### File: `src/components/timeline/EntryCard.tsx`

**1. cardBase function (lines 537-548)** -- Wrap image/fade in inner clipping container

Replace the direct image/fade children with a wrapping div:

```tsx
{/* Background clipping container -- always clips to rounded corners */}
<div className="absolute inset-0 overflow-hidden rounded-[14px]">
  {firstImage ? (
    <>
      <img src={firstImage} alt={option.name} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 z-[5]" style={{ background: DIAGONAL_GRADIENTS[tier] }} />
    </>
  ) : (
    <>
      <div className="absolute inset-0" style={{ background: glossyBg, border: glossyBorder }} />
      <div className="absolute inset-0 z-[5]" style={{ background: glassBg }} />
    </>
  )}
</div>
```

This is a single structural change inside the `cardBase` function that fixes all tiers at once.

**2. Verify text positioning** -- Confirm `right: 54` is not overridden

The compact (line 576) and medium short-entry (line 596) content divs both set `right: 54` in the inline style object. This is correct. I will double-check no Tailwind class on those divs adds a conflicting `right` value.

