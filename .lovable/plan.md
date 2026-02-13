

# Soften Mode Shadow + Full Opacity Function Buttons

## Changes in `src/components/timeline/TransportConnector.tsx`

### 1. Reduce selected mode shadow intensity

On the selected mode button (line 182), soften the box-shadow values:

**Before:**
```
boxShadow: isDark
  ? '0 0 0 1.5px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.3)'
  : '0 0 0 1.5px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)'
```

**After:**
```
boxShadow: isDark
  ? '0 0 0 1px rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.15)'
  : '0 0 0 1px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)'
```

### 2. Full opacity on function buttons (info, refresh, trash)

The info button (line 157), refresh button (line 196), and delete button (line 206) all use `opacity-50`. Change these to full opacity by removing `opacity-50` and keeping only hover styles.

- Info button: remove `opacity-50`, keep `hover:opacity-80`
- Refresh button: remove `opacity-50`, keep `hover:opacity-80`
- Delete button (non-confirming state): remove `opacity-50`, keep `hover:opacity-80`

### What does not change

- Colours, two-layer structure, mode switching, pointer-events logic, z-index stacking

