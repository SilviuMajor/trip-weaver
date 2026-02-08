import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryOption, EntryWithOptions } from '@/types/trip';
import { haversineKm } from '@/lib/distance';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ImageGallery from './ImageGallery';
import ImageUploader from './ImageUploader';
import MapPreview from './MapPreview';
import VoteButton from './VoteButton';

interface EntryOverlayProps {
  entry: EntryWithOptions | null;
  option: EntryOption | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatTime: (iso: string) => string;
  userLat: number | null;
  userLng: number | null;
  votingLocked: boolean;
  userVotes: string[]; // option IDs the user has voted for
  onVoteChange: () => void;
  onImageUploaded: () => void;
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
}: EntryOverlayProps) => {
  const { currentUser, isEditor } = useCurrentUser();

  if (!entry || !option) return null;

  const distance =
    userLat != null && userLng != null && option.latitude != null && option.longitude != null
      ? haversineKm(userLat, userLng, option.latitude, option.longitude)
      : null;

  const hasVoted = userVotes.includes(option.id);
  const images = option.images ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl p-0">
        {/* Image Gallery */}
        <div className="p-4 pb-0">
          {images.length > 0 ? (
            <ImageGallery images={images} />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted">
              <span className="text-sm text-muted-foreground">No photos yet</span>
            </div>
          )}
        </div>

        <div className="space-y-4 p-4">
          <SheetHeader className="text-left">
            {/* Category */}
            {option.category && (
              <Badge
                className="w-fit text-[10px] uppercase tracking-wider"
                style={
                  option.category_color
                    ? { backgroundColor: option.category_color, color: '#fff' }
                    : undefined
                }
              >
                {option.category}
              </Badge>
            )}
            <SheetTitle className="font-display text-xl">{option.name}</SheetTitle>
          </SheetHeader>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatTime(entry.start_time)} — {formatTime(entry.end_time)}</span>
          </div>

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

          {/* Image Upload (editors only) */}
          {isEditor && (
            <ImageUploader
              optionId={option.id}
              currentCount={images.length}
              onUploaded={onImageUploaded}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EntryOverlay;
