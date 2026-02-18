import { useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Settings, Loader2, RefreshCw, Trash2, MapPin, Navigation, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import RouteMapPreview from './RouteMapPreview';
import type { EntryWithOptions, EntryOption, TransportMode } from '@/types/trip';

interface TransportOverlayProps {
  open: boolean;
  onClose: () => void;
  entry: EntryWithOptions;
  option: EntryOption;
  formatTime: (iso: string) => string;
  onSaved: () => void;
  onDelete?: () => void;
}

const MODE_OPTIONS = [
  { mode: 'walk', emoji: '🚶', label: 'Walk' },
  { mode: 'transit', emoji: '🚌', label: 'Transit' },
  { mode: 'drive', emoji: '🚗', label: 'Drive' },
  { mode: 'bicycle', emoji: '🚲', label: 'Cycle' },
] as const;

const MODE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  walk:    { bg: 'rgba(74,222,128,0.06)',  text: '#4ade80', border: '#4ade80' },
  transit: { bg: 'rgba(251,191,36,0.08)',  text: '#fbbf24', border: '#fbbf24' },
  drive:   { bg: 'rgba(239,68,68,0.06)',   text: '#ef4444', border: '#ef4444' },
  bicycle: { bg: 'rgba(96,165,250,0.06)',  text: '#60a5fa', border: '#60a5fa' },
};

const MODE_MAP_GOOGLE: Record<string, string> = {
  walk: 'walking', transit: 'transit', drive: 'driving', bicycle: 'bicycling',
};
const MODE_MAP_APPLE: Record<string, string> = {
  walk: 'w', transit: 'r', drive: 'd', bicycle: 'w',
};

const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const fmtDist = (km: number) => km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;

const detectMode = (name: string): string => {
  const lower = (name || '').toLowerCase();
  if (lower.startsWith('walk')) return 'walk';
  if (lower.startsWith('drive')) return 'drive';
  if (lower.startsWith('cycle')) return 'bicycle';
  return 'transit';
};

export default function TransportOverlay({
  open, onClose, entry, option, formatTime, onSaved, onDelete,
}: TransportOverlayProps) {
  const isMobile = useIsMobile();
  const [selectedMode, setSelectedMode] = useState(() => detectMode(option.name));
  const [switching, setSwitching] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [localModes, setLocalModes] = useState<TransportMode[] | null>(null);

  const allModes: TransportMode[] = localModes ?? (option.transport_modes as TransportMode[] | null) ?? [];
  const hasModes = allModes.length > 0;

  const selectedModeData = allModes.find(m => m.mode === selectedMode);

  const fromShort = (option.departure_location || 'Unknown').split(',')[0].trim();
  const toShort = (option.arrival_location || 'Unknown').split(',')[0].trim();

  const isAndroid = /android/i.test(navigator.userAgent);

  const fromAddr = option.departure_location || '';
  const toAddr = option.arrival_location || '';

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromAddr)}&destination=${encodeURIComponent(toAddr)}&travelmode=${MODE_MAP_GOOGLE[selectedMode] || 'transit'}`;
  const appleMapsUrl = `https://maps.apple.com/?saddr=${encodeURIComponent(fromAddr)}&daddr=${encodeURIComponent(toAddr)}&dirflg=${MODE_MAP_APPLE[selectedMode] || 'r'}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${encodeURIComponent(fromAddr)}&dropoff[formatted_address]=${encodeURIComponent(toAddr)}`;

  // Decode last point of polyline for dest coordinates
  const destCoords = useMemo(() => {
    if (option.latitude && option.longitude) return { lat: option.latitude, lng: option.longitude };
    return null;
  }, [option.latitude, option.longitude]);

  const handleModeSwitch = async (mode: string) => {
    if (mode === selectedMode || switching) return;
    const modeData = allModes.find(m => m.mode === mode);
    if (!modeData) return;

    setSelectedMode(mode);
    setSwitching(mode);

    try {
      const blockDur = Math.ceil(modeData.duration_min / 5) * 5;
      const newEndIso = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();

      await supabase.from('entries').update({ end_time: newEndIso }).eq('id', entry.id);

      const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
      const newName = `${modeLabels[mode] || mode} to ${toShort}`;
      await supabase.from('entry_options').update({
        name: newName,
        distance_km: modeData.distance_km,
        route_polyline: modeData.polyline ?? null,
      } as any).eq('id', option.id);

      // Pull/push next event
      if (entry.to_entry_id) {
        const { data: nextEntry } = await supabase.from('entries')
          .select('id, start_time, end_time, is_locked')
          .eq('id', entry.to_entry_id).single();
        if (nextEntry && !nextEntry.is_locked) {
          const newEnd = new Date(new Date(entry.start_time).getTime() + blockDur * 60000);
          const dur = new Date(nextEntry.end_time).getTime() - new Date(nextEntry.start_time).getTime();
          await supabase.from('entries').update({
            start_time: newEnd.toISOString(),
            end_time: new Date(newEnd.getTime() + dur).toISOString(),
          }).eq('id', nextEntry.id);
        }
      }

      onSaved();
    } catch (err) {
      console.error('Mode switch failed:', err);
    } finally {
      setSwitching(null);
    }
  };

  const handleRefreshRoutes = async () => {
    if (refreshing || !fromAddr || !toAddr) return;
    setRefreshing(true);

    try {
      const { data } = await supabase.functions.invoke('google-directions', {
        body: {
          fromAddress: fromAddr,
          toAddress: toAddr,
          modes: ['walk', 'transit', 'drive', 'bicycle'],
          departureTime: entry.start_time,
        },
      });

      const results: TransportMode[] = data?.results ?? [];
      if (results.length > 0) {
        await supabase.from('entry_options').update({
          transport_modes: results as any,
        }).eq('id', option.id);
        setLocalModes(results);

        // Update current mode's data
        const currentData = results.find(r => r.mode === selectedMode);
        if (currentData) {
          const blockDur = Math.ceil(currentData.duration_min / 5) * 5;
          const newEndIso = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();
          await supabase.from('entries').update({ end_time: newEndIso }).eq('id', entry.id);
          await supabase.from('entry_options').update({
            distance_km: currentData.distance_km,
            route_polyline: currentData.polyline ?? null,
          } as any).eq('id', option.id);
        }

        onSaved();
      }
    } catch (err) {
      console.error('Refresh routes failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = () => {
    onDelete?.();
  };

  const content = (
    <div className="px-4 pb-6 pt-4 max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-base font-semibold">{fromShort} → {toShort}</h3>
        <p className="text-xs text-muted-foreground">
          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
        </p>
      </div>

      {/* Mode Grid */}
      {hasModes ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {MODE_OPTIONS.map(({ mode, emoji, label }) => {
            const data = allModes.find(m => m.mode === mode);
            const isActive = mode === selectedMode;
            const isSwitching = switching === mode;
            const colors = MODE_COLORS[mode];

            return (
              <button
                key={mode}
                onClick={() => handleModeSwitch(mode)}
                disabled={!data || !!switching}
                className="relative rounded-xl p-3 text-left transition-all"
                style={{
                  border: isActive ? `2px solid hsl(var(--primary))` : '2px solid transparent',
                  background: data ? (isActive ? colors.bg : `${colors.bg.replace(/[\d.]+\)$/, '0.04)')}`) : undefined,
                  opacity: data ? 1 : 0.4,
                  cursor: data ? 'pointer' : 'not-allowed',
                }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[13px] font-medium" style={{ color: colors.text }}>
                    {emoji} {label}
                  </span>
                  {data && (
                    <span className="text-[17px] font-bold leading-tight" style={{ color: colors.text }}>
                      {fmtDur(data.duration_min)}
                    </span>
                  )}
                </div>
                {data ? (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtDist(data.distance_km)}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground/50 mt-0.5">Unavailable</div>
                )}
                {isSwitching && (
                  <Loader2 className="absolute top-2 right-2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 mb-4 rounded-xl border border-dashed border-muted-foreground/30">
          <p className="text-sm text-muted-foreground mb-3">No route data available</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshRoutes}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh routes
          </Button>
        </div>
      )}

      {/* Route Map */}
      {(selectedModeData?.polyline || (option as any).route_polyline) ? (
        <div className="mb-4 rounded-xl overflow-hidden border border-border" style={{ height: 160 }}>
          <RouteMapPreview
            polyline={selectedModeData?.polyline || (option as any).route_polyline || ''}
            fromAddress={fromAddr}
            toAddress={toAddr}
            travelMode={selectedMode}
            size="full"
            destLat={destCoords?.lat}
            destLng={destCoords?.lng}
            destName={toShort}
            className="h-full [&>div:first-child]:h-full [&_img]:h-full"
          />
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-border bg-muted/30 flex items-center justify-center" style={{ height: 160 }}>
          <p className="text-xs text-muted-foreground">No route available</p>
        </div>
      )}

      {/* Deep Links */}
      <div className="mb-4">
        <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Open directions</p>
        <div className="flex gap-2">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <MapPin className="h-[18px] w-[18px] text-foreground" />
            <span className="text-[10px] font-bold text-foreground">Google Maps</span>
          </a>
          {!isAndroid && (
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Navigation className="h-[18px] w-[18px] text-foreground" />
              <span className="text-[10px] font-bold text-foreground">Apple Maps</span>
            </a>
          )}
          <a
            href={uberUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <Car className="h-[18px] w-[18px] text-foreground" />
            <span className="text-[10px] font-bold text-foreground">Uber</span>
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshRoutes}
          disabled={refreshing}
          className="text-xs"
        >
          {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh routes
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DrawerContent className="rounded-t-2xl">
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm p-0">
        {content}
      </DialogContent>
    </Dialog>
  );
}
