import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Copy, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { toast } from '@/hooks/use-toast';
import type { Trip, TripUser } from '@/types/trip';

const TripSettings = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { adminUser, isAdmin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripUser[]>([]);
  const [tripName, setTripName] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/auth');
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!tripId) return;
    const fetchData = async () => {
      const [{ data: tripData }, { data: membersData }] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('trip_users').select('*').eq('trip_id', tripId).order('created_at'),
      ]);
      if (tripData) {
        setTrip(tripData as unknown as Trip);
        setTripName(tripData.name);
      }
      setMembers((membersData ?? []) as unknown as TripUser[]);
      setLoading(false);
    };
    fetchData();
  }, [tripId]);

  const handleSaveName = async () => {
    if (!tripId || !tripName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('trips')
      .update({ name: tripName.trim() })
      .eq('id', tripId);
    if (error) {
      toast({ title: 'Failed to rename', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Trip renamed!' });
      setTrip(prev => prev ? { ...prev, name: tripName.trim() } : prev);
    }
    setSaving(false);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/trip/${tripId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: 'Link copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('trip_users').delete().eq('id', memberId);
    if (error) {
      toast({ title: 'Failed to remove member', description: error.message, variant: 'destructive' });
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast({ title: 'Member removed' });
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    const { error } = await supabase
      .from('trip_users')
      .update({ role })
      .eq('id', memberId);
    if (error) {
      toast({ title: 'Failed to update role', description: error.message, variant: 'destructive' });
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: role as TripUser['role'] } : m));
    }
  };

  if (authLoading || loading) {
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
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trip/${tripId}/timeline`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Trip Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-8 px-4 py-8">
        {/* Rename */}
        <section className="space-y-3">
          <Label htmlFor="trip-name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trip Name</Label>
          <div className="flex gap-2">
            <Input
              id="trip-name"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
            />
            <Button onClick={handleSaveName} disabled={saving} size="icon">
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Share link */}
        <section className="space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Share Link</Label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <code className="flex-1 truncate text-sm text-muted-foreground">
              {`${window.location.origin}/trip/${tripId}`}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </section>

        {/* Members */}
        <section className="space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Members ({members.length})
          </Label>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                </div>
                <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No members yet</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default TripSettings;
