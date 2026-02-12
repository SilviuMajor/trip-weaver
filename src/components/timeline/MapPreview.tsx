import { ExternalLink, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapPreviewProps {
  latitude: number;
  longitude: number;
  locationName?: string | null;
}

const MapPreview = ({ latitude, longitude, locationName }: MapPreviewProps) => {
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=600x200&markers=${latitude},${longitude},red-pushpin`;
  const appleMapsUrl = `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(locationName || 'Location')}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <div className="space-y-2">
      {locationName && (
        <p className="text-sm font-medium text-foreground">{locationName}</p>
      )}
      <div className="overflow-hidden rounded-lg border border-border">
        <img
          src={staticMapUrl}
          alt="Map preview"
          className="h-[150px] w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          asChild
        >
          <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-1 h-3 w-3" />
            Apple Maps
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          asChild
        >
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" />
            Google Maps
          </a>
        </Button>
      </div>
    </div>
  );
};

export default MapPreview;
