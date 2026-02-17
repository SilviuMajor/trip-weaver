import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';

interface TransportOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transportEntryId: string;
  fromAddress: string;
  toAddress: string;
  currentMode: string;
  durationMin: number;
  distanceKm?: number | null;
  allModes: Array<{ mode: string; duration_min: number; distance_km: number; polyline?: string }>;
  departureTime: string;
  onModeSwitchConfirm: (entryId: string, mode: string, newDurationMin: number, distanceKm: number, polyline?: string | null) => Promise<void>;
}

const MODE_OPTIONS = [
  { mode: 'walk', label: '🚶 Walk', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-400' },
  { mode: 'transit', label: '🚌 Transit', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-400' },
  { mode: 'drive', label: '🚗 Drive', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-400' },
  { mode: 'bicycle', label: '🚲 Cycle', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-400' },
];

const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const fmtDist = (km: number) => km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;

export default function TransportOverlay({
  open, onOpenChange, transportEntryId, fromAddress, toAddress,
  currentMode, allModes, onModeSwitchConfirm,
}: TransportOverlayProps) {
  const [switching, setSwitching] = useState<string | null>(null);

  const handleModeSwitch = async (mode: string) => {
    if (mode === currentMode || switching) return;
    const modeData = allModes.find(m => m.mode === mode);
    if (!modeData) return;

    setSwitching(mode);
    try {
      await onModeSwitchConfirm(
        transportEntryId,
        mode,
        modeData.duration_min,
        modeData.distance_km,
        modeData.polyline,
      );
      onOpenChange(false);
    } catch (err) {
      console.error('Mode switch failed:', err);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4 max-h-[50vh]">
        <SheetHeader className="mb-3">
          <SheetTitle className="text-base">Transport</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground truncate">
            {fromAddress.split(',')[0]} → {toAddress.split(',')[0]}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2">
          {MODE_OPTIONS.map(({ mode, label, color }) => {
            const data = allModes.find(m => m.mode === mode);
            const isActive = mode === currentMode;
            const isSwitching = switching === mode;

            return (
              <button
                key={mode}
                onClick={() => handleModeSwitch(mode)}
                disabled={!data || !!switching}
                className={`
                  relative rounded-xl p-3 text-left transition-all border-2
                  ${isActive ? color : 'border-transparent bg-muted/50 hover:bg-muted'}
                  ${!data ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="font-medium text-sm">{label}</div>
                {data ? (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtDur(data.duration_min)} · {fmtDist(data.distance_km)}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/50 mt-0.5">Unavailable</div>
                )}
                {isSwitching && (
                  <Loader2 className="absolute top-2 right-2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
