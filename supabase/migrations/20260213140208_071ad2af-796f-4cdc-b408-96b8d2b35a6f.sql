
-- Create hotels table
CREATE TABLE public.hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  website TEXT,
  phone TEXT,
  rating NUMERIC(2,1),
  user_rating_count INTEGER,
  google_place_id TEXT,
  google_maps_uri TEXT,
  check_in_date DATE,
  check_in_time TIME DEFAULT '15:00',
  checkout_date DATE,
  checkout_time TIME DEFAULT '11:00',
  evening_return TIME DEFAULT '22:00',
  morning_leave TIME DEFAULT '08:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- Open access policies (matching existing pattern)
CREATE POLICY "Anyone can view hotels" ON public.hotels FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hotels" ON public.hotels FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hotels" ON public.hotels FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hotels" ON public.hotels FOR DELETE USING (true);

-- Add hotel_id to entry_options
ALTER TABLE public.entry_options ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

-- Timestamp trigger for hotels
CREATE TRIGGER update_hotels_updated_at
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
