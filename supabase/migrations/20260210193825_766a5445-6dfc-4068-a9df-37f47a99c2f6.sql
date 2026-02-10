
-- Add route_polyline column to entry_options for storing encoded polyline of transport routes
ALTER TABLE public.entry_options ADD COLUMN route_polyline TEXT;
