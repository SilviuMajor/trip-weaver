
CREATE TABLE public.global_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_place_id text,
  name text NOT NULL,
  category text,
  city text,
  country text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'want_to_go' CHECK (status IN ('visited', 'want_to_go')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('trip_auto', 'trip_planner', 'explore_save', 'manual', 'favourite')),
  source_trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  rating numeric,
  price_level text,
  opening_hours jsonb,
  website text,
  phone text,
  address text,
  notes text,
  starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_global_places_user ON public.global_places(user_id);
CREATE INDEX idx_global_places_google ON public.global_places(user_id, google_place_id);
CREATE INDEX idx_global_places_city ON public.global_places(user_id, city);

-- Unique constraint: one entry per user per google_place_id (partial)
CREATE UNIQUE INDEX idx_global_places_unique ON public.global_places(user_id, google_place_id) WHERE google_place_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.global_places ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own global places" ON public.global_places FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own global places" ON public.global_places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own global places" ON public.global_places FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own global places" ON public.global_places FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_global_places_updated_at
  BEFORE UPDATE ON public.global_places
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
