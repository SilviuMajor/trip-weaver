import { useState, useEffect } from 'react';

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
}

export function useGeolocation() {
  const [geo, setGeo] = useState<GeoState>({
    latitude: null,
    longitude: null,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeo({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          error: null,
        });
      },
      (err) => {
        setGeo(prev => ({ ...prev, error: err.message }));
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return geo;
}
