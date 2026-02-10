import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { TRAVEL_MODES } from '@/lib/categories';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TransportResult {
  mode: string;
  duration_min: number;
  distance_km: number;
}

interface TransportPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromAddress: string;
  toAddress: string;
  departureTime: string;
  onConfirm: (result: TransportResult) => void;
  children: React.ReactNode;
}

const formatDurationShort = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const TransportPicker = ({
  open,
  onOpenChange,
  fromAddress,
  toAddress,
  departureTime,
  onConfirm,
  children,
}: TransportPickerProps) => {
  const [results, setResults] = useState<TransportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchAllModes = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: {
          fromAddress,
          toAddress,
          modes: ['walk', 'transit', 'drive', 'bicycle'],
          departureTime,
        },
      });
      if (error) throw error;
      setResults(data?.results ?? []);
      setFetched(true);
      // Auto-select the fastest mode
      if (data?.results?.length > 0) {
        const fastest = data.results.reduce((a: TransportResult, b: TransportResult) =>
          a.duration_min < b.duration_min ? a : b
        );
        setSelectedMode(fastest.mode);
      }
    } catch (err) {
      console.error('Transport fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !fetched) {
      fetchAllModes();
    }
    if (!isOpen) {
      setFetched(false);
      setResults([]);
      setSelectedMode(null);
    }
  };

  const modeEmoji: Record<string, string> = {
    walk: '🚶',
    transit: '🚌',
    drive: '🚗',
    bicycle: '🚲',
  };

  const selected = results.find(r => r.mode === selectedMode);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Transport mode</p>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 && fetched ? (
          <p className="text-xs text-muted-foreground py-2">No routes found</p>
        ) : (
          <div className="space-y-1.5">
            {results.map(r => (
              <button
                key={r.mode}
                onClick={() => setSelectedMode(r.mode)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  selectedMode === r.mode
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                <span className="text-base">{modeEmoji[r.mode] ?? '🚌'}</span>
                <span className="flex-1 text-left capitalize">{r.mode === 'bicycle' ? 'Cycle' : r.mode}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDurationShort(r.duration_min)} · {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)}m` : `${r.distance_km.toFixed(1)}km`}
                </span>
                {selectedMode === r.mode && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={() => onConfirm(selected)}
          >
            Add {formatDurationShort(selected.duration_min)} {selected.mode === 'bicycle' ? 'cycle' : selected.mode}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default TransportPicker;
