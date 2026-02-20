import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, LogOut, Moon, Sun } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from 'next-themes';
import { toast } from '@/hooks/use-toast';
import UserAvatar from '@/components/UserAvatar';

const Settings = () => {
  const { adminUser, isAdmin, loading: authLoading, signOut } = useAdminAuth();
  const { displayName, loading: profileLoading, updateDisplayName } = useProfile(adminUser?.id);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(() => {
    return localStorage.getItem('timeline-zoom-enabled') !== 'false';
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/auth');
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (displayName) setName(displayName);
  }, [displayName]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = (await updateDisplayName(name)) ?? {};
    if (error) {
      toast({ title: 'Failed to save', description: (error as any).message, variant: 'destructive' });
    } else {
      toast({ title: 'Display name saved!' });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Account</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        {/* Profile section */}
        <div className="mb-8 flex items-center gap-4">
          <UserAvatar name={displayName || adminUser?.email} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold truncate">{displayName || 'Set your name'}</p>
            <p className="text-sm text-muted-foreground truncate">{adminUser?.email}</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Name */}
          <div className="space-y-3">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <p className="text-xs text-muted-foreground">
              This is how you appear on trips
            </p>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          {/* Preferences */}
          <div className="space-y-4 border-t border-border pt-6">
            <h2 className="text-lg font-semibold">Preferences</h2>

            {/* Theme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-xs text-muted-foreground">
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                  </p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>

            {/* Zoom */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pinch-to-zoom</Label>
                <p className="text-xs text-muted-foreground">
                  Zoom on the timeline
                </p>
              </div>
              <Switch
                checked={zoomEnabled}
                onCheckedChange={(checked) => {
                  setZoomEnabled(checked);
                  localStorage.setItem('timeline-zoom-enabled', String(checked));
                  toast({ title: checked ? 'Zoom enabled' : 'Zoom disabled' });
                }}
              />
            </div>
          </div>

          {/* Sign out */}
          <Button variant="destructive" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
