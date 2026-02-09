import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, ExternalLink, Pencil, Trash2, Lock, Unlock, Lightbulb, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { EntryOption, EntryWithOptions } from '@/types/trip';
import { haversineKm } from '@/lib/distance';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from '@/hooks/use-toast';
import ImageGallery from './ImageGallery';
import ImageUploader from './ImageUploader';
import MapPreview from './MapPreview';
import VoteButton from './VoteButton';

function formatTimeInTz(isoString: string, tz: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getTzAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz.split('/').pop() ?? tz;
  } catch {
    return tz.split('/').pop() ?? tz;
  }
}

interface EntryOverlayProps {
  entry: EntryWithOptions | null;
  option: EntryOption | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatTime: (iso: string) => string;
  userLat: number | null;
  userLng: number | null;
  votingLocked: boolean;
  userVotes: string[];
  onVoteChange: () => void;
  onImageUploaded: () => void;
  onEdit?: (entry: EntryWithOptions, option: EntryOption) => void;
  onDeleted?: () => void;
  onMoveToIdeas?: (entryId: string) => void;
}

const EntryOverlay = ({
  entry,
  option,
  open,
  onOpenChange,
  formatTime,
  userLat,
  userLng,
  votingLocked,
  userVotes,
  onVoteChange,
  onImageUploaded,
  onEdit,
  onDeleted,
  onMoveToIdeas,
}: EntryOverlayProps) => {
  const { currentUser, isEditor } = useCurrentUser();
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (!entry || !option) return null;

  const distance =
    userLat != null && userLng != null && option.latitude != null && option.longitude != null
      ? haversineKm(userLat, userLng, option.latitude, option.longitude)
      : null;

  const hasVoted = userVotes.includes(option.id);
  const images = option.images ?? [];
  const isLocked = entry.is_locked;
  const isFlight = option.category === 'flight' && option.departure_tz && option.arrival_tz;

  const handleToggleLock = async () => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('entries')
        .update({ is_locked: !isLocked } as any)
        .eq('id', entry.id);
      if (error) throw error;
      toast({ title: isLocked ? 'Entry unlocked' : 'Entry locked' });
      onDeleted?.(); // refresh data
    } catch (err: any) {
      toast({ title: 'Failed to toggle lock', description: err.message, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  // Flight duration in minutes
  const flightDurationMin = isFlight
    ? Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000)
    : 0;
  const flightHours = Math.floor(flightDurationMin / 60);
  const flightMins = flightDurationMin % 60;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl p-0">
        <div className="space-y-4 p-4">
          <SheetHeader className="text-left">
            {option.category && (
              <Badge
                className="w-fit gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={
                  option.category_color
                    ? { backgroundColor: option.category_color, color: '#fff' }
                    : undefined
                }
              >
                {isFlight && <Plane className="h-3 w-3" />}
                {option.category}
              </Badge>
            )}
            <SheetTitle className="font-display text-xl">{option.name}</SheetTitle>
          </SheetHeader>

          {/* Flight-specific details */}
          {isFlight ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                {/* Departure */}
                <div className="flex-1 text-left space-y-0.5">
                  <p className="text-sm font-bold text-foreground">
                    {option.departure_location || 'Departure'}
                  </p>
                  {option.departure_terminal && (
                    <p className="text-xs text-muted-foreground">{option.departure_terminal}</p>
                  )}
                  <p className="text-lg font-semibold text-foreground">
                    {formatTimeInTz(entry.start_time, option.departure_tz!)}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {getTzAbbr(option.departure_tz!)}
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Plane className="h-4 w-4 text-muted-foreground" />
                  <div className="h-px w-12 bg-border" />
                  <span className="text-[10px] text-muted-foreground">
                    {flightHours > 0 ? `${flightHours}h ` : ''}{flightMins}m
                  </span>
                </div>

                {/* Arrival */}
                <div className="flex-1 text-right space-y-0.5">
                  <p className="text-sm font-bold text-foreground">
                    {option.arrival_location || 'Arrival'}
                  </p>
                  {option.arrival_terminal && (
                    <p className="text-xs text-muted-foreground">{option.arrival_terminal}</p>
                  )}
                  <p className="text-lg font-semibold text-foreground">
                    {formatTimeInTz(entry.end_time, option.arrival_tz!)}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {getTzAbbr(option.arrival_tz!)}
                  </p>
                </div>
              </div>

              {isLocked && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Locked
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Generic time */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatTime(entry.start_time)} — {formatTime(entry.end_time)}</span>
                {isLocked && (
                  <Lock className="ml-1 h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </div>
            </>
          )}

          {/* Distance */}
          {distance !== null && (
            <p className="text-sm text-muted-foreground">
              📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
            </p>
          )}

          {/* Website */}
          {option.website && (
            <a
              href={option.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Visit website
            </a>
          )}

          {/* Map */}
          {option.latitude != null && option.longitude != null && (
            <MapPreview
              latitude={option.latitude}
              longitude={option.longitude}
              locationName={option.location_name}
            />
          )}

          {/* Vote */}
          {currentUser && (
            <div className="flex items-center gap-3">
              <VoteButton
                optionId={option.id}
                userId={currentUser.id}
                voteCount={option.vote_count ?? 0}
                hasVoted={hasVoted}
                locked={votingLocked}
                onVoteChange={onVoteChange}
              />
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="pt-2">
              <ImageGallery images={images} />
            </div>
          )}

          {/* Image Upload (editors only) */}
          {isEditor && (
            <ImageUploader
              optionId={option.id}
              currentCount={images.length}
              onUploaded={onImageUploaded}
            />
          )}

          {/* Edit / Delete / Lock / Move to Ideas (editors only) */}
          {isEditor && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEdit(entry, option);
                    onOpenChange(false);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleLock}
                disabled={toggling}
              >
                {isLocked ? (
                  <>
                    <Unlock className="mr-1.5 h-3.5 w-3.5" />
                    Unlock
                  </>
                ) : (
                  <>
                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                    Lock
                  </>
                )}
              </Button>

              {onMoveToIdeas && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMoveToIdeas(entry.id)}
                >
                  <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
                  Move to ideas
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the entry and all its options. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          const { error } = await supabase
                            .from('entries')
                            .delete()
                            .eq('id', entry.id);
                          if (error) throw error;
                          toast({ title: 'Entry deleted' });
                          onOpenChange(false);
                          onDeleted?.();
                        } catch (err: any) {
                          toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EntryOverlay;
