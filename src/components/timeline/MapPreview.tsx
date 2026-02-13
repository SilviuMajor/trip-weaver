import { useState } from 'react';
import { ExternalLink, Navigation, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapPreviewProps {
  latitude: number;
  longitude: number;
  locationName?: string | null;
}

const MapPreview = ({ latitude, longitude, locationName }: MapPreviewProps) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const staticMapUrl = `${supabaseUrl}/functions/v1/static-map?lat=${latitude}&lng=${longitude}`;
  const appleMapsUrl = `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(locationName || 'Location')}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=my_location&pickup[longitude]=my_location&pickup[nickname]=My%20Location&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${encodeURIComponent(locationName || 'Destination')}`;
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-2">
      {locationName && (
        <p className="text-sm font-medium text-foreground">{locationName}</p>
      )}
      {!imgError && (
        <div className="overflow-hidden rounded-lg border border-border">
          <img
            src={staticMapUrl}
            alt="Map preview"
            className="h-[150px] w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      <div className="space-y-2">
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
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs bg-black text-white hover:bg-black/90 border-black"
          asChild
        >
          <a href={uberUrl} target="_blank" rel="noopener noreferrer">
            <Car className="mr-1 h-3 w-3" />
            Uber
          </a>
        </Button>
      </div>
    </div>
  );
};

export default MapPreview;
