
-- 1. Create app_role enum for admin roles
CREATE TYPE public.app_role AS ENUM ('admin');

-- 2. Create user_roles table (roles stored separately per security requirements)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles without recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add owner_id to trips (the Supabase Auth admin who created it)
ALTER TABLE public.trips ADD COLUMN owner_id uuid REFERENCES auth.users(id);

-- 6. Add timezone and category_presets to trips
ALTER TABLE public.trips ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Amsterdam';
ALTER TABLE public.trips ADD COLUMN category_presets jsonb DEFAULT '[]'::jsonb;

-- 7. Add trip_id to trip_users (nullable initially for backfill of existing data)
ALTER TABLE public.trip_users ADD COLUMN trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE;

-- 8. Create travel_segments table
CREATE TABLE public.travel_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  to_entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  duration_min integer,
  distance_km numeric,
  mode text DEFAULT 'transit',
  polyline text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view travel segments"
  ON public.travel_segments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert travel segments"
  ON public.travel_segments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update travel segments"
  ON public.travel_segments FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete travel segments"
  ON public.travel_segments FOR DELETE USING (true);

-- 9. Create weather_cache table
CREATE TABLE public.weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  date date NOT NULL,
  hour integer NOT NULL,
  temp_c numeric,
  condition text,
  icon_code text,
  humidity integer,
  wind_speed numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, date, hour)
);

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view weather cache"
  ON public.weather_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert weather cache"
  ON public.weather_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update weather cache"
  ON public.weather_cache FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete weather cache"
  ON public.weather_cache FOR DELETE USING (true);

-- 10. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.travel_segments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weather_cache;

-- 11. Updated_at trigger for weather_cache
CREATE TRIGGER update_weather_cache_updated_at
  BEFORE UPDATE ON public.weather_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
