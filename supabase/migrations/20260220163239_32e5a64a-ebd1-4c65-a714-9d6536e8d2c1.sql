
-- Migration 1: Add columns & indexes
ALTER TABLE trip_users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trip_users_user_id ON trip_users(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_users_trip_id_user_id ON trip_users(trip_id, user_id);

-- Backfill invite codes for existing trips
UPDATE trips SET invite_code = substr(md5(random()::text), 1, 8) WHERE invite_code IS NULL;

-- Migration 2: Update handle_new_user trigger to include display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Migration 3: Auto-generate invite code for new trips
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := substr(md5(random()::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trips_generate_invite_code ON trips;
CREATE TRIGGER trips_generate_invite_code
  BEFORE INSERT ON trips
  FOR EACH ROW EXECUTE FUNCTION public.generate_invite_code();

-- Migration 4: RLS policies & helper functions

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can view trips" ON trips;
DROP POLICY IF EXISTS "Anyone can insert trips" ON trips;
DROP POLICY IF EXISTS "Anyone can update trips" ON trips;
DROP POLICY IF EXISTS "Anyone can view entries" ON entries;
DROP POLICY IF EXISTS "Anyone can insert entries" ON entries;
DROP POLICY IF EXISTS "Anyone can update entries" ON entries;
DROP POLICY IF EXISTS "Anyone can delete entries" ON entries;
DROP POLICY IF EXISTS "Anyone can view entry options" ON entry_options;
DROP POLICY IF EXISTS "Anyone can insert entry options" ON entry_options;
DROP POLICY IF EXISTS "Anyone can update entry options" ON entry_options;
DROP POLICY IF EXISTS "Anyone can delete entry options" ON entry_options;
DROP POLICY IF EXISTS "Anyone can view trip users" ON trip_users;
DROP POLICY IF EXISTS "Anyone can insert trip users" ON trip_users;
DROP POLICY IF EXISTS "Anyone can update trip users" ON trip_users;
DROP POLICY IF EXISTS "Anyone can delete trip users" ON trip_users;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_users
    WHERE trip_users.trip_id = $1
    AND trip_users.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_trip_organiser(trip_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_users
    WHERE trip_users.trip_id = $1
    AND trip_users.user_id = auth.uid()
    AND trip_users.role = 'organizer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_trip_editor(trip_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_users
    WHERE trip_users.trip_id = $1
    AND trip_users.user_id = auth.uid()
    AND trip_users.role IN ('organizer', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- TRIPS policies
CREATE POLICY "trips_select" ON trips FOR SELECT USING (
  owner_id = auth.uid() OR is_trip_member(id)
);
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (
  owner_id = auth.uid()
);
-- Also allow reading a trip by invite_code (for the join flow)
CREATE POLICY "trips_select_by_invite" ON trips FOR SELECT USING (
  invite_code IS NOT NULL
);

-- ENTRIES policies
CREATE POLICY "entries_select" ON entries FOR SELECT USING (
  is_trip_member(trip_id)
);
CREATE POLICY "entries_insert" ON entries FOR INSERT WITH CHECK (
  is_trip_editor(trip_id)
);
CREATE POLICY "entries_update" ON entries FOR UPDATE USING (
  is_trip_editor(trip_id)
);
CREATE POLICY "entries_delete" ON entries FOR DELETE USING (
  is_trip_editor(trip_id)
);

-- ENTRY_OPTIONS policies
CREATE POLICY "entry_options_select" ON entry_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM entries WHERE entries.id = entry_options.entry_id AND is_trip_member(entries.trip_id))
);
CREATE POLICY "entry_options_insert" ON entry_options FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM entries WHERE entries.id = entry_options.entry_id AND is_trip_editor(entries.trip_id))
);
CREATE POLICY "entry_options_update" ON entry_options FOR UPDATE USING (
  EXISTS (SELECT 1 FROM entries WHERE entries.id = entry_options.entry_id AND is_trip_editor(entries.trip_id))
);
CREATE POLICY "entry_options_delete" ON entry_options FOR DELETE USING (
  EXISTS (SELECT 1 FROM entries WHERE entries.id = entry_options.entry_id AND is_trip_editor(entries.trip_id))
);

-- TRIP_USERS policies
CREATE POLICY "trip_users_select" ON trip_users FOR SELECT USING (
  is_trip_member(trip_id)
);
CREATE POLICY "trip_users_insert" ON trip_users FOR INSERT WITH CHECK (
  is_trip_organiser(trip_id) OR user_id = auth.uid()
);
CREATE POLICY "trip_users_update" ON trip_users FOR UPDATE USING (
  is_trip_organiser(trip_id)
);
CREATE POLICY "trip_users_delete" ON trip_users FOR DELETE USING (
  is_trip_organiser(trip_id)
);

-- PROFILES policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());
