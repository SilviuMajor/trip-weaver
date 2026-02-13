import { useState } from 'react';
import { ExternalLink, Navigation, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RouteMapPreviewProps {
  polyline: string;
  fromAddress: string;
  toAddress: string;
  travelMode: string;
  size?: 'mini' | 'full';
  className?: string;
  destLat?: number | null;
  destLng?: number | null;
  destName?: string | null;
}

const GOOGLE_MODE_MAP: Record<string, string> = {
  walk: 'walking',
  walking: 'walking',
  transit: 'transit',
  drive: 'driving',
  driving: 'driving',
  bicycle: 'bicycling',
  cycling: 'bicycling',
};

const APPLE_MODE_MAP: Record<string, string> = {
  walk: 'w',
  walking: 'w',
  transit: 'r',
  drive: 'd',
  driving: 'd',
  bicycle: 'w',
  cycling: 'w',
};

const RouteMapPreview = ({
  polyline,
  fromAddress,
  toAddress,
  travelMode,
  size = 'full',
  className,
  destLat,
  destLng,
  destName,
}: RouteMapPreviewProps) => {
  const [imgError, setImgError] = useState(false);
  const isMini = size === 'mini';
  const mapSize = isMini ? '200x80' : '600x200';

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const staticMapUrl = `${supabaseUrl}/functions/v1/static-map?path=${encodeURIComponent(polyline)}&size=${mapSize}`;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromAddress)}&destination=${encodeURIComponent(toAddress)}&travelmode=${GOOGLE_MODE_MAP[travelMode] ?? 'transit'}`;
  const appleMapsUrl = `https://maps.apple.com/?saddr=${encodeURIComponent(fromAddress)}&daddr=${encodeURIComponent(toAddress)}&dirflg=${APPLE_MODE_MAP[travelMode] ?? 'r'}`;

  const uberUrl = destLat != null && destLng != null
    ? `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=my_location&pickup[longitude]=my_location&pickup[nickname]=My%20Location&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${encodeURIComponent(destName || 'Destination')}`
    : null;

  if (isMini) {
    return (
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'block overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80',
          className
        )}
      >
        {!imgError && (
          <img
            src={staticMapUrl}
            alt="Route preview"
            className="h-[40px] w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
      </a>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {!imgError && (
        <div className="overflow-hidden rounded-lg border border-border">
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={staticMapUrl}
              alt="Route map"
              className="h-[150px] w-full object-cover transition-opacity hover:opacity-90"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </a>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
          <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-1 h-3 w-3" />
            Apple Maps
          </a>
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" />
            Google Maps
          </a>
        </Button>
        {uberUrl && (
          <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
            <a href={uberUrl} target="_blank" rel="noopener noreferrer">
              <Car className="mr-1 h-3 w-3" />
              Uber
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};

export default RouteMapPreview;
