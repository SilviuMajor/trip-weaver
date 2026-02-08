
-- Add updated_at column to travel_segments
ALTER TABLE public.travel_segments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Add trigger for travel_segments updated_at
CREATE TRIGGER update_travel_segments_updated_at
BEFORE UPDATE ON public.travel_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill trip_users.trip_id with the first trip for any null values
UPDATE public.trip_users
SET trip_id = (SELECT id FROM public.trips ORDER BY created_at ASC LIMIT 1)
WHERE trip_id IS NULL;
