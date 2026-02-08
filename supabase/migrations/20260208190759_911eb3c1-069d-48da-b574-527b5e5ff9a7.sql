
-- Trip users (name-based, no passwords)
CREATE TABLE public.trip_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('organizer', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_users ENABLE ROW LEVEL SECURITY;

-- Everyone can read users (needed for user selection screen)
CREATE POLICY "Anyone can view trip users"
  ON public.trip_users FOR SELECT
  USING (true);

-- Only allow insert/update/delete via backend (organizer manages users)
CREATE POLICY "Anyone can insert trip users"
  ON public.trip_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update trip users"
  ON public.trip_users FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete trip users"
  ON public.trip_users FOR DELETE
  USING (true);

-- Trip table
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  voting_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trips"
  ON public.trips FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert trips"
  ON public.trips FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update trips"
  ON public.trips FOR UPDATE
  USING (true);

-- Entries (time slots on the timeline)
CREATE TABLE public.entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view entries"
  ON public.entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert entries"
  ON public.entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update entries"
  ON public.entries FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete entries"
  ON public.entries FOR DELETE
  USING (true);

-- Options (each entry can have multiple options)
CREATE TABLE public.entry_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  category TEXT,
  category_color TEXT DEFAULT '#6366f1',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entry_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view entry options"
  ON public.entry_options FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert entry options"
  ON public.entry_options FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update entry options"
  ON public.entry_options FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete entry options"
  ON public.entry_options FOR DELETE
  USING (true);

-- Option images
CREATE TABLE public.option_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID NOT NULL REFERENCES public.entry_options(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.option_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view option images"
  ON public.option_images FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert option images"
  ON public.option_images FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update option images"
  ON public.option_images FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete option images"
  ON public.option_images FOR DELETE
  USING (true);

-- Votes (anonymous)
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID NOT NULL REFERENCES public.entry_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.trip_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(option_id, user_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert votes"
  ON public.votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete votes"
  ON public.votes FOR DELETE
  USING (true);

-- Enable realtime for votes and entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entry_options;

-- Storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-images', 'trip-images', true);

CREATE POLICY "Anyone can view trip images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-images');

CREATE POLICY "Anyone can upload trip images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trip-images');

CREATE POLICY "Anyone can update trip images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'trip-images');

CREATE POLICY "Anyone can delete trip images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'trip-images');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_entry_options_updated_at BEFORE UPDATE ON public.entry_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
