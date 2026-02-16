

# Fix: EntryCard short-entry rendering across all tiers

## Problem
The compact and medium tiers bypass the `isShortEntry` logic entirely -- they never pass `overflowVisible` to `cardBase`, use wrong font sizes, and show time when they shouldn't. The condensed and full short branches also incorrectly show time text.

## Changes (all in `src/components/timeline/EntryCard.tsx`)

### 1. Compact tier (lines 569-584)
- Pass `isShortEntry` as 3rd argument to `cardBase()` to enable `overflow-visible`
- Replace flex-based content with absolute-positioned centered content: `absolute top-1/2 -translate-y-1/2 z-10 text-right`, with `left: isMicroEntry ? 30 : 10`, `right: 54`
- Change title from `text-[11px] font-semibold` to `text-sm font-bold`
- Remove the time span entirely (compact is always too short)

### 2. Medium tier (lines 588-606)
- Pass `isShortEntry` as 3rd argument to `cardBase()`
- When `isShortEntry` is true: use absolute centered content (same pattern as compact), no time, `text-sm font-bold` title
- When `isShortEntry` is false: keep bottom-right content but change title to `text-sm font-bold`, keep time display
- Remove time from the short-entry branch only

### 3. Condensed short branch (lines 615-626)
- Remove the time span (lines 623-625) from the `isShortEntry` branch only
- The normal branch (lines 628-643) keeps time -- no change there

### 4. Full short branch (lines 658-669)
- Remove the time span (lines 666-668) from the `isShortEntry` branch only
- The normal branch (lines 670-730) keeps time -- no change there

## Summary of time display rules

| Tier | isShortEntry? | Show time? |
|------|--------------|------------|
| Compact | always | never |
| Medium | true | no |
| Medium | false | yes |
| Condensed | true | no |
| Condensed | false | yes |
| Full | true | no |
| Full | false | yes |

