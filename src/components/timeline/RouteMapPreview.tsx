import { ExternalLink, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RouteMapPreviewProps {
  polyline: string;
  fromAddress: string;
  toAddress: string;
  travelMode: string;
  size?: 'mini' | 'full';
  className?: string;
}

const GOOGLE_MODE_MAP: Record<string, string> = {
  walk: 'walking',
  transit: 'transit',
  drive: 'driving',
  bicycle: 'bicycling',
};

const APPLE_MODE_MAP: Record<string, string> = {
  walk: 'w',
  transit: 'r',
  drive: 'd',
  bicycle: 'w', // Apple Maps doesn't have a cycling mode flag
};

const RouteMapPreview = ({
  polyline,
  fromAddress,
  toAddress,
  travelMode,
  size = 'full',
  className,
}: RouteMapPreviewProps) => {
  const isMini = size === 'mini';
  const mapSize = isMini ? '200x80' : '600x200';

  // Use OpenStreetMap static map with polyline - we can't easily draw polylines on OSM static maps,
  // so we use a simple approach: show a map centered between the two endpoints
  // For a proper polyline, we'd need to decode it and use a tile-based renderer
  // Instead, we'll link to Google Maps directions which shows the actual route
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromAddress)}&destination=${encodeURIComponent(toAddress)}&travelmode=${GOOGLE_MODE_MAP[travelMode] ?? 'transit'}`;
  const appleMapsUrl = `https://maps.apple.com/?saddr=${encodeURIComponent(fromAddress)}&daddr=${encodeURIComponent(toAddress)}&dirflg=${APPLE_MODE_MAP[travelMode] ?? 'r'}`;

  // Use a static map image showing the route via Google's directions embed approach
  // Since we can't use API key client-side, we use the OSM static map as a background 
  // and overlay a "View Route" CTA
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?size=${mapSize}&maptype=mapnik&path=enc:${encodeURIComponent(polyline)}`;

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
        <img
          src={staticMapUrl}
          alt="Route preview"
          className="h-[40px] w-full object-cover"
          loading="lazy"
          onError={(e) => {
            // Hide if static map fails
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </a>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-hidden rounded-lg border border-border">
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={staticMapUrl}
            alt="Route map"
            className="h-[150px] w-full object-cover transition-opacity hover:opacity-90"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </a>
      </div>
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
      </div>
    </div>
  );
};

export default RouteMapPreview;
