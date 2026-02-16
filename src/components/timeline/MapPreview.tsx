import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MapPreviewProps {
  latitude: number;
  longitude: number;
  locationName?: string | null;
}

const MapPreview = ({ latitude, longitude, locationName }: MapPreviewProps) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const staticMapUrl = `${supabaseUrl}/functions/v1/static-map?lat=${latitude}&lng=${longitude}`;
  const [imgError, setImgError] = useState(false);

  const appleMapsUrl = `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(locationName || 'Location')}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=my_location&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${encodeURIComponent(locationName || 'Destination')}`;

  if (imgError) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring">
          <img
            src={staticMapUrl}
            alt="Map preview"
            className="h-[120px] w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2 flex flex-col gap-1" align="center">
        <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
          🗺️ Apple Maps
        </a>
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
          📍 Google Maps
        </a>
        <a href={uberUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
          🚗 Uber
        </a>
      </PopoverContent>
    </Popover>
  );
};

export default MapPreview;
