-- Add latitude/longitude to weather_cache for location-aware weather
ALTER TABLE public.weather_cache ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.weather_cache ADD COLUMN IF NOT EXISTS longitude numeric;