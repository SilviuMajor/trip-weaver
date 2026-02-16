import { useState, useEffect } from 'react';
import { ClipboardList, Check } from 'lucide-react';
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
  isInTrip?: boolean;
  compactHours?: string | null;
}

const extractHue = (hslString: string): number => {
  const match = hslString.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 260;
};

const ExploreCard = ({ place, categoryId, onAddToPlanner, onTap, travelTime, isInTrip, compactHours }: ExploreCardProps) => {
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

  // Glossy backgrounds (copied from SidebarEntryCard)
  const glossyBg = isDark
    ? `linear-gradient(145deg, hsl(${hue}, 30%, 16%), hsl(${hue}, 15%, 9%))`
    : `linear-gradient(145deg, hsl(${hue}, 25%, 92%), hsl(${hue}, 15%, 86%))`;
  const glassBg = isDark
    ? 'linear-gradient(152deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.02) 40%, transparent 55%)'
    : 'linear-gradient(152deg, rgba(255,255,255,0.6) 25%, rgba(255,255,255,0.3) 40%, transparent 55%)';
  const glossyBorder = isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)';

  const textColor = hasImage ? 'text-white' : isDark ? 'text-white' : 'text-foreground';
  const subTextColor = hasImage ? 'text-white/70' : isDark ? 'text-white/60' : 'text-muted-foreground';

  // Duration pill style (same as SidebarEntryCard)
  const durPillStyle: React.CSSProperties = hasImage
    ? { background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }
    : isDark
      ? { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }
      : { background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', color: 'hsl(25, 30%, 20%)' };

  const priceDisplay = formatPriceLevel(place.priceLevel);

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
          <div className="absolute inset-0 z-[5]" style={{ background: 'linear-gradient(152deg, transparent 25%, rgba(10,8,6,0.3) 35%, rgba(10,8,6,0.7) 50%, rgba(10,8,6,0.92) 65%)' }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: glossyBg, border: glossyBorder }} />
          <div className="absolute inset-0 z-[5]" style={{ background: glassBg }} />
        </>
      )}

      {/* Corner flag */}
      <div
        className="absolute top-0 left-0 z-20 flex items-center justify-center"
        style={{ background: color, padding: '5px 7px', borderRadius: '14px 0 8px 0' }}
      >
        <span className="text-white" style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      </div>

      {/* Travel time pill — top-right */}
      {travelTime && (
        <div
          className="absolute top-2 right-2 z-20 rounded-full text-[11px] font-bold px-2.5 py-1"
          style={durPillStyle}
        >
          {travelTime}
        </div>
      )}

      {/* Content — bottom area */}
      <div className={cn('absolute bottom-0 left-0 right-0 z-10 px-3 py-2.5 flex items-end justify-between gap-2')}>
        {/* Left: rating + price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {place.rating != null && (
              <span className={cn('text-[10px] leading-tight', subTextColor)}>
                ⭐ {place.rating.toFixed(1)}
                {place.userRatingCount != null && (
                  <span> ({Number(place.userRatingCount).toLocaleString()})</span>
                )}
              </span>
            )}
            {priceDisplay && place.rating != null && (
              <span className={cn('text-[10px]', subTextColor)}>·</span>
            )}
            {priceDisplay && (
              <span className={cn('text-[10px]', subTextColor)}>{priceDisplay}</span>
            )}
            {isInTrip && (
              <span className={cn('text-[9px] font-semibold', hasImage ? 'text-green-300' : 'text-green-600 dark:text-green-400')}>
                ✓ Added
              </span>
            )}
          </div>
        </div>

        {/* Right: planner icon */}
        {isInTrip ? (
          <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm shrink-0">
            <Check className="h-4 w-4 text-white" />
          </div>
        ) : (
          <button
            className="h-8 w-8 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm shrink-0 hover:bg-white/30 transition-colors"
            onClick={(e) => { e.stopPropagation(); onAddToPlanner(); }}
          >
            <ClipboardList className="h-4 w-4 text-white" />
          </button>
        )}
      </div>

      {/* Name + address — positioned above the bottom row */}
      <div className={cn('absolute bottom-8 right-0 z-10 text-right max-w-[80%] px-3', textColor)}>
        <p className="truncate text-sm font-bold leading-tight" style={{ textShadow: hasImage ? '0 1px 3px rgba(0,0,0,0.3)' : undefined }}>
          {place.name}
        </p>
        {place.address && (
          <p className={cn('truncate text-[10px] leading-tight mt-0.5', subTextColor)}>
            📍 {place.address}
          </p>
        )}
        {compactHours && (
          <p className={cn('text-[9px] leading-tight mt-0.5', subTextColor)}>
            {compactHours}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExploreCard;
