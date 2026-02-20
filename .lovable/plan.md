

# Polished Invite Landing Page

## What changes

### 1. Rewrite `src/pages/Invite.tsx`
Replace the current simple "auto-join-or-redirect" page with a polished version that:
- Fetches trip info first (name, destination, dates, emoji, image) using the public invite_code RLS policy
- Shows a preview card to unauthenticated users with "Sign Up to Join" and "I Already Have an Account" buttons
- Auto-joins logged-in users as viewers, then redirects to dashboard
- Shows proper error state for invalid codes
- Navigates to dashboard (`/`) after joining instead of the timeline

### 2. Update `src/pages/Auth.tsx` (1 line)
Change line 14 from:
```
const [isSignUp, setIsSignUp] = useState(false);
```
to:
```
const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true');
```
This makes the auth page open in signup mode when arriving from the invite page's "Sign Up to Join" button.

### 3. No changes needed to:
- **App.tsx** -- route already exists
- **Dashboard.tsx** -- copy link already fixed in previous changes

## User flow
1. Recipient opens `tr1p.co.uk/invite/abc123de`
2. Sees trip preview card (name, emoji/image, destination, dates)
3. Clicks "Sign Up to Join" --> goes to auth page in signup mode with redirect back to invite
4. After signing up/logging in --> redirected back to invite page
5. Invite page detects session --> auto-joins as viewer --> redirects to dashboard
6. Existing members who click the link are recognized and sent straight to the dashboard

