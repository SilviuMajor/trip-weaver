import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { EntryWithOptions } from '@/types/trip';
import type { ExploreResult } from './ExploreView';

// Custom marker icons
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface FitBoundsProps {
  entries: EntryWithOptions[];
  results: ExploreResult[];
  originLat: number;
  originLng: number;
}

const FitBounds = ({ entries, results, originLat, originLng }: FitBoundsProps) => {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [[originLat, originLng]];
    entries.forEach(e => {
      const opt = e.options[0];
      if (opt?.latitude && opt?.longitude) points.push([opt.latitude, opt.longitude]);
    });
    results.forEach(r => {
      if (r.lat && r.lng) points.push([r.lat, r.lng]);
    });
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] });
    }
  }, [entries, results, originLat, originLng, map]);
  return null;
};

interface ExploreMapProps {
  entries: EntryWithOptions[];
  sortedResults: ExploreResult[];
  originLat: number;
  originLng: number;
  onPinTap?: (placeId: string) => void;
  selectedPlaceId?: string | null;
}

const ExploreMap = ({ entries, sortedResults, originLat, originLng, onPinTap, selectedPlaceId }: ExploreMapProps) => {
  return (
    <MapContainer
      center={[originLat, originLng]}
      zoom={14}
      className="h-full w-full z-0"
      scrollWheelZoom
      style={{ minHeight: 250 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Blue pins: scheduled entries */}
      {entries
        .filter(e => e.is_scheduled && e.options[0]?.latitude)
        .map(entry => {
          const opt = entry.options[0];
          return (
            <Marker
              key={entry.id}
              position={[opt.latitude!, opt.longitude!]}
              icon={blueIcon}
            >
              <Popup>
                <div className="text-sm font-semibold">{opt.name}</div>
                <div className="text-xs text-muted-foreground">On your timeline</div>
              </Popup>
            </Marker>
          );
        })}

      {/* Gold pins: explore results */}
      {sortedResults.map(place =>
        place.lat && place.lng ? (
          <Marker
            key={place.placeId}
            position={[place.lat, place.lng]}
            icon={goldIcon}
            eventHandlers={{
              click: () => onPinTap?.(place.placeId),
            }}
          >
            <Popup>
              <div className="text-sm font-semibold">{place.name}</div>
              {place.rating != null && (
                <div className="text-xs">⭐ {place.rating} ({place.userRatingCount?.toLocaleString()})</div>
              )}
              {place.address && <div className="text-xs text-muted-foreground">{place.address}</div>}
            </Popup>
          </Marker>
        ) : null,
      )}

      <FitBounds entries={entries} results={sortedResults} originLat={originLat} originLng={originLng} />
    </MapContainer>
  );
};

export default ExploreMap;
