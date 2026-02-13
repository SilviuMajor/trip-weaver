import { RefreshCw, Loader2, X, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EntryWithOptions, EntryOption, TransportMode } from '@/types/trip';
import RouteMapPreview from './RouteMapPreview';

const MODE_CONFIG: { mode: string; emoji: string; label: string; apiMode: string }[] = [
  { mode: 'walk', emoji: '🚶', label: 'Walk', apiMode: 'walk' },
  { mode: 'drive', emoji: '🚗', label: 'Drive', apiMode: 'drive' },
  { mode: 'transit', emoji: '🚌', label: 'Transit', apiMode: 'transit' },
  { mode: 'bicycle', emoji: '🚲', label: 'Bike', apiMode: 'bicycle' },
];

const MODE_BORDER_COLORS: Record<string, string> = {
  walk: 'border-green-400',
  drive: 'border-red-400',
  transit: 'border-amber-400',
  bicycle: 'border-blue-400',
};

const fmtDur = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

const fmtDist = (km: number | null | undefined): string => {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
};

interface TransportOverviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: EntryOption;
  entry: EntryWithOptions;
  fromLabel: string;
  toLabel: string;
  selectedMode: string;
  onModeSelect: (mode: string, durationMin: number, distanceKm: number, polyline?: string | null) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDelete: () => void;
}

const TransportOverviewSheet = ({
  open,
  onOpenChange,
  option,
  entry,
  fromLabel,
  toLabel,
  selectedMode,
  onModeSelect,
  onRefresh,
  isRefreshing,
  onDelete,
}: TransportOverviewSheetProps) => {
  const transportModes: TransportMode[] = (option as any).transport_modes ?? [];
  const selectedData = transportModes.find(m => m.mode === selectedMode);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3 max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          style={{ width: 44, height: 44 }}
        >
          <X className="h-5 w-5 text-foreground" />
        </button>

        {/* Title */}
        <h2 className="text-lg font-bold text-foreground mb-3">Route</h2>

        {/* From → To */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <span className="font-medium text-foreground truncate max-w-[40%]">{fromLabel || 'Origin'}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <span className="font-medium text-foreground truncate max-w-[40%]">{toLabel || 'Destination'}</span>
        </div>

        {/* Mode grid — 2x2 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {MODE_CONFIG.map(({ emoji, label, apiMode }) => {
            const modeData = transportModes.find(m => m.mode === apiMode);
            const isSelected = selectedMode === apiMode;
            const durLabel = modeData ? fmtDur(modeData.duration_min) : '—';
            const distLabel = modeData ? fmtDist(modeData.distance_km) : '';

            return (
              <button
                key={apiMode}
                onClick={() => {
                  if (modeData && !isSelected) {
                    onModeSelect(apiMode, modeData.duration_min, modeData.distance_km, modeData.polyline);
                  }
                }}
                disabled={!modeData}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left',
                  isSelected
                    ? `${MODE_BORDER_COLORS[apiMode] || 'border-primary'} bg-secondary/50`
                    : 'border-border hover:border-muted-foreground/30',
                  !modeData && 'opacity-30 cursor-not-allowed'
                )}
              >
                <span className="text-2xl">{emoji}</span>
                <div className="flex flex-col">
                  <span className={cn('text-xs font-semibold', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {label}
                  </span>
                  <span className={cn('text-sm font-bold', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {durLabel}
                  </span>
                  {distLabel && (
                    <span className="text-[10px] text-muted-foreground/70">{distLabel}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected mode details */}
        {selectedData && (
          <div className="flex items-center justify-center gap-4 rounded-lg bg-secondary/50 px-4 py-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-lg font-bold text-foreground">{fmtDur(selectedData.duration_min)}</div>
            </div>
            {selectedData.distance_km != null && (
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Distance</div>
                <div className="text-lg font-bold text-foreground">{fmtDist(selectedData.distance_km)}</div>
              </div>
            )}
          </div>
        )}

        {/* Map preview */}
        {(option as any).route_polyline && (
          <div className="mb-4">
            <RouteMapPreview
              polyline={(option as any).route_polyline}
              fromAddress={fromLabel || ''}
              toAddress={toLabel || ''}
              travelMode={selectedMode}
              size="full"
            />
          </div>
        )}

        {/* Refresh button */}
        <Button
          variant="secondary"
          className="w-full mb-2"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Refreshing…</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> Refresh routes</>
          )}
        </Button>

        {/* Delete button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            onDelete();
            onOpenChange(false);
          }}
        >
          Delete transport
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default TransportOverviewSheet;
