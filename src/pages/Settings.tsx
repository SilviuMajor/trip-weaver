import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';

const Settings = () => {
  const { adminUser, isAdmin, loading: authLoading } = useAdminAuth();
  const { displayName, loading: profileLoading, updateDisplayName } = useProfile(adminUser?.id);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

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
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Account Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 py-8">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={adminUser?.email ?? ''} disabled className="opacity-60" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <p className="text-xs text-muted-foreground">
            This name is used when you're added to trips
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </main>
    </div>
  );
};

export default Settings;
