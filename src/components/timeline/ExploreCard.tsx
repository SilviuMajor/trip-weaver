import { useState, useEffect } from 'react';
import { ClipboardList, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findCategory } from '@/lib/categories';
import { formatPriceLevel } from '@/lib/entryHelpers';
import { supabase } from '@/integrations/supabase/client';
import type { ExploreResult } from './ExploreView';

interface ExploreCardProps {
  place: ExploreResult;
  categoryId: string | null;
  onAddToPlanner: () => void;
  onTap: () => void;
  travelTime?: string | null;
  travelTimeLoading?: boolean;
  isInTrip?: boolean;
  compactHours?: string | null;
  crossTripName?: string | null;
  isLoading?: boolean;
}

const extractHue = (hslString: string): number => {
  const match = hslString.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 260;
};

const ExploreCard = ({ place, categoryId, onAddToPlanner, onTap, travelTime, travelTimeLoading, isInTrip, compactHours, crossTripName, isLoading }: ExploreCardProps) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(place.photoUrl ?? null);

  const cat = findCategory(categoryId ?? '');
  const emoji = cat?.emoji ?? '📌';
  const color = cat?.color ?? 'hsl(260, 50%, 55%)';
  const hue = extractHue(color);
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  // Photo loading
  useEffect(() => {
    if (!place.photoRef || photoUrl) return;
    let cancelled = false;
    supabase.functions.invoke('google-places', {
      body: { action: 'photo', photoRef: place.photoRef },
    }).then(({ data }) => {
      if (!cancelled && data?.url) setPhotoUrl(data.url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [place.photoRef]);

  const hasImage = !!photoUrl;

  // Glossy backgrounds for no-image fallback
  const glossyBg = isDark
    ? `linear-gradient(145deg, hsl(${hue}, 30%, 16%), hsl(${hue}, 15%, 9%))`
    : `linear-gradient(145deg, hsl(${hue}, 25%, 92%), hsl(${hue}, 15%, 86%))`;
  const glassBg = isDark
    ? 'linear-gradient(152deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.02) 40%, transparent 55%)'
    : 'linear-gradient(152deg, rgba(255,255,255,0.6) 25%, rgba(255,255,255,0.3) 40%, transparent 55%)';
  const glossyBorder = isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)';

  const priceDisplay = formatPriceLevel(place.priceLevel);
  const isClosedText = compactHours?.toLowerCase().includes('closed');

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-[14px] overflow-hidden cursor-pointer transition-all hover:shadow-lg w-full',
      )}
      style={{ height: 140, opacity: isInTrip ? 0.75 : 1 }}
      onClick={onTap}
    >
      {/* Background */}
      {hasImage ? (
        <>
          <img src={photoUrl!} alt={place.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 z-[5]" style={{ background: 'linear-gradient(148deg, transparent 15%, rgba(10,8,6,0.20) 25%, rgba(10,8,6,0.65) 38%, rgba(10,8,6,0.96) 50%)' }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: glossyBg, border: glossyBorder }} />
          <div className="absolute inset-0 z-[5]" style={{ background: glassBg }} />
        </>
      )}

      {/* Corner flag — top-left */}
      <div
        className="absolute top-0 left-0 z-20 flex items-center justify-center"
        style={{ background: color, padding: '5px 7px', borderRadius: '14px 0 8px 0' }}
      >
        <span className="text-white" style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      </div>

      {/* Planner button — top-right */}
      {isInTrip ? (
        <div
          className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full flex items-center justify-center bg-orange-500 shadow-lg shadow-orange-500/30 scale-105 transition-all"
        >
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </div>
      ) : (
        <button
          className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full flex items-center justify-center bg-orange-400/35 backdrop-blur-sm border border-orange-400/30 hover:bg-orange-400/50 transition-colors"
          onClick={(e) => { e.stopPropagation(); onAddToPlanner(); }}
        >
          <ClipboardList className="h-3.5 w-3.5 text-white opacity-90" />
        </button>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 rounded-[14px]">
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        </div>
      )}

      {/* Travel time pill — bottom-left */}
      {travelTime ? (
        <div
          className="absolute bottom-2.5 left-2.5 z-20 rounded-full text-[11px] font-bold text-white/80 px-2 py-0.5"
          style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {travelTime}
        </div>
      ) : travelTimeLoading ? (
        <div
          className="absolute bottom-2.5 left-2.5 z-20 w-10 h-5 rounded-full animate-pulse"
          style={{ background: 'rgba(255,255,255,0.12)', opacity: 0.5 }}
        />
      ) : null}

      {/* Content — bottom-right, right-aligned */}
      <div className="absolute bottom-0 right-0 z-10 px-3 py-2.5 text-right" style={{ maxWidth: '72%' }}>
        {compactHours && (
          <p className={cn(
            'text-[9px] leading-tight',
            isClosedText ? 'text-red-300' : 'text-white/55'
          )}>
            {compactHours}
          </p>
        )}
        <p className="truncate text-sm font-bold leading-tight text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
          {place.name}
        </p>
        {(place.address || priceDisplay) && (
          <p className="truncate text-[10px] leading-tight text-white/60 mt-0.5">
            {place.address && <>📍 {place.address}</>}
            {place.address && priceDisplay && <> · </>}
            {priceDisplay}
          </p>
        )}
        {place.rating != null && (
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <span className="text-[13px] font-bold text-amber-300">⭐ {place.rating.toFixed(1)}</span>
            {place.userRatingCount != null && (
              <span className="text-[10px] text-white/45">({Number(place.userRatingCount).toLocaleString()})</span>
            )}
          </div>
        )}
        {crossTripName && (
          <div className="text-[9px] leading-tight mt-0.5 text-white/60">
            📌 In your {crossTripName} trip
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreCard;
