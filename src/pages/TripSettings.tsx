import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Save, Copy, X, Check, Plus, Trash2, CalendarIcon, Upload, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import type { Trip, TripUser } from '@/types/trip';
import { cn } from '@/lib/utils';

const TripSettings = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { adminUser, isAdmin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripUser[]>([]);
  const [tripName, setTripName] = useState('');
  const [tripDestination, setTripDestination] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Add member state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<string>('viewer');
  const [addingMember, setAddingMember] = useState(false);

  // Date conversion state
  const [startDateInput, setStartDateInput] = useState('');
  const [settingDates, setSettingDates] = useState(false);

  // Icon state
  const [tripEmoji, setTripEmoji] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EMOJI_OPTIONS = ['✈️', '🏖️', '🏔️', '🎿', '🗼', '🚗', '🚢', '🏕️', '🎉', '🌍'];

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
        const t = tripData as unknown as Trip;
        setTrip(t);
        setTripName(t.name);
        setTripDestination(t.destination ?? '');
        setTripEmoji(t.emoji ?? '');
      }
      setMembers((membersData ?? []) as unknown as TripUser[]);
      setLoading(false);
    };
    fetchData();
  }, [tripId]);

  const handleSave = async () => {
    if (!tripId || !tripName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('trips')
      .update({ name: tripName.trim(), destination: tripDestination.trim() || null } as any)
      .eq('id', tripId);
    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved!' });
      setTrip(prev => prev ? { ...prev, name: tripName.trim(), destination: tripDestination.trim() || null } : prev);
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

  const handleAddMember = async () => {
    if (!tripId || !newMemberName.trim()) return;
    setAddingMember(true);
    const { data, error } = await supabase
      .from('trip_users')
      .insert({ name: newMemberName.trim(), role: newMemberRole, trip_id: tripId })
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Failed to add member', description: error.message, variant: 'destructive' });
    } else {
      setMembers(prev => [...prev, data as unknown as TripUser]);
      setNewMemberName('');
      setNewMemberRole('viewer');
      toast({ title: 'Member added!' });
    }
    setAddingMember(false);
  };

  const handleDeleteTrip = async () => {
    if (!tripId) return;
    setDeleting(true);
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) {
      toast({ title: 'Failed to delete trip', description: error.message, variant: 'destructive' });
      setDeleting(false);
    } else {
      toast({ title: 'Trip deleted' });
      navigate('/dashboard');
    }
  };

  const handleSetDates = async () => {
    if (!tripId || !trip || !startDateInput) return;
    setSettingDates(true);
    try {
      const startDate = parseISO(startDateInput);
      const durationDays = trip.duration_days ?? 3;
      const endDate = addDays(startDate, durationDays - 1);

      // Update trip dates
      const { error: tripError } = await supabase.from('trips').update({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      } as any).eq('id', tripId);
      if (tripError) throw tripError;

      // Shift all entries from 2099-01-xx to real dates
      const { data: allEntries } = await supabase.from('entries').select('*').eq('trip_id', tripId);
      if (allEntries) {
        for (const entry of allEntries) {
          const entryStart = new Date(entry.start_time);
          const entryEnd = new Date(entry.end_time);
          const refBase = new Date('2099-01-01T00:00:00Z');
          const dayOffset = Math.round((entryStart.getTime() - refBase.getTime()) / (1000 * 60 * 60 * 24));

          if (dayOffset >= 0 && dayOffset < 365) {
            const realDate = addDays(startDate, dayOffset);
            const startTimeStr = format(entryStart, 'HH:mm:ss');
            const endTimeStr = format(entryEnd, 'HH:mm:ss');
            const newStart = `${format(realDate, 'yyyy-MM-dd')}T${startTimeStr}Z`;
            const newEnd = `${format(realDate, 'yyyy-MM-dd')}T${endTimeStr}Z`;

            await supabase.from('entries').update({
              start_time: newStart,
              end_time: newEnd,
            }).eq('id', entry.id);
          }
        }
      }

      setTrip(prev => prev ? {
        ...prev,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      } : prev);

      toast({ title: 'Trip dates set! All entries shifted to real dates. 🎉' });
    } catch (err: any) {
      toast({ title: 'Failed to set dates', description: err.message, variant: 'destructive' });
    } finally {
      setSettingDates(false);
    }
  };

  const isUndated = !trip?.start_date;

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
        {/* Name & Destination */}
        <section className="space-y-3">
          <Label htmlFor="trip-name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trip Name</Label>
          <Input id="trip-name" value={tripName} onChange={(e) => setTripName(e.target.value)} />
          <Label htmlFor="trip-destination" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Destination</Label>
          <Input id="trip-destination" value={tripDestination} onChange={(e) => setTripDestination(e.target.value)} placeholder="Amsterdam, Netherlands" />
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </section>

        {/* Trip Icon */}
        <section className="space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ImageIcon className="mr-1.5 inline h-4 w-4" />
            Trip Icon
          </Label>
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            {/* Current icon preview */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-3xl">
                {trip?.image_url ? (
                  <img src={trip.image_url} alt="Trip icon" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  tripEmoji || '✈️'
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {trip?.image_url ? 'Custom image' : tripEmoji ? `Emoji: ${tripEmoji}` : 'Default plane icon'}
              </p>
            </div>

            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pick an emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={async () => {
                      setTripEmoji(e);
                      await supabase.from('trips').update({ emoji: e } as any).eq('id', tripId!);
                      setTrip(prev => prev ? { ...prev, emoji: e } : prev);
                      toast({ title: `Icon set to ${e}` });
                    }}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-all hover:scale-110',
                      tripEmoji === e ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Or type any emoji…"
                value={tripEmoji}
                onChange={async (ev) => {
                  const val = ev.target.value;
                  setTripEmoji(val);
                  await supabase.from('trips').update({ emoji: val || null } as any).eq('id', tripId!);
                  setTrip(prev => prev ? { ...prev, emoji: val || null } : prev);
                }}
                className="mt-1.5 w-32"
              />
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Or upload an image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file || !tripId) return;
                  setUploadingIcon(true);
                  try {
                    const ext = file.name.split('.').pop() ?? 'png';
                    const path = `trips/${tripId}/icon.${ext}`;
                    const { error: upErr } = await supabase.storage.from('trip-images').upload(path, file, { upsert: true });
                    if (upErr) throw upErr;
                    const { data: urlData } = supabase.storage.from('trip-images').getPublicUrl(path);
                    const imageUrl = urlData.publicUrl + '?t=' + Date.now();
                    await supabase.from('trips').update({ image_url: imageUrl } as any).eq('id', tripId);
                    setTrip(prev => prev ? { ...prev, image_url: imageUrl } : prev);
                    toast({ title: 'Trip image uploaded!' });
                  } catch (err: any) {
                    toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
                  } finally {
                    setUploadingIcon(false);
                  }
                }}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingIcon}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {uploadingIcon ? 'Uploading…' : 'Upload Image'}
                </Button>
                {trip?.image_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await supabase.from('trips').update({ image_url: null } as any).eq('id', tripId!);
                      setTrip(prev => prev ? { ...prev, image_url: null } : prev);
                      toast({ title: 'Image removed' });
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Trip Dates */}
        <section className="space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarIcon className="mr-1.5 inline h-4 w-4" />
            Trip Dates
          </Label>
          {isUndated ? (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Currently undated ({trip?.duration_days ?? 3} days: Day 1, Day 2…). Set a start date to convert to real calendar dates.
              </p>
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSetDates}
                disabled={!startDateInput || settingDates}
                size="sm"
              >
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                {settingDates ? 'Setting dates…' : 'Set Dates & Shift Entries'}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm">
                <span className="font-medium">{trip?.start_date}</span> → <span className="font-medium">{trip?.end_date}</span>
              </p>
            </div>
          )}
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
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => handleRemoveMember(m.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No members yet</p>
            )}
          </div>

          {/* Add member */}
          <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="New member name" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-9" disabled={!newMemberName.trim() || addingMember} onClick={handleAddMember}>
              <Plus className="mr-1 h-3.5 w-3.5" />Add
            </Button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <Label className="text-sm font-semibold uppercase tracking-wider text-destructive">Danger Zone</Label>
          <p className="text-sm text-muted-foreground">
            Deleting this trip will permanently remove all entries, options, votes, and travel data. This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete Trip
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{trip?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the trip and all its entries, options, votes, images, and travel segments. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteTrip}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete trip'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
    </div>
  );
};

export default TripSettings;
