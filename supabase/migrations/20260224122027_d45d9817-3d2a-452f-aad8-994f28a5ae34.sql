
-- =====================================================
-- Fix RLS policies for ancillary tables
-- =====================================================

-- HOTELS: Replace permissive policies with trip-member-scoped
DROP POLICY IF EXISTS "Anyone can view hotels" ON hotels;
DROP POLICY IF EXISTS "Anyone can insert hotels" ON hotels;
DROP POLICY IF EXISTS "Anyone can update hotels" ON hotels;
DROP POLICY IF EXISTS "Anyone can delete hotels" ON hotels;

CREATE POLICY "hotels_select" ON hotels FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "hotels_insert" ON hotels FOR INSERT WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY "hotels_update" ON hotels FOR UPDATE USING (is_trip_editor(trip_id));
CREATE POLICY "hotels_delete" ON hotels FOR DELETE USING (is_trip_editor(trip_id));

-- OPTION_GROUPS: Replace permissive policies with trip-member-scoped
DROP POLICY IF EXISTS "Anyone can view option groups" ON option_groups;
DROP POLICY IF EXISTS "Anyone can insert option groups" ON option_groups;
DROP POLICY IF EXISTS "Anyone can update option groups" ON option_groups;
DROP POLICY IF EXISTS "Anyone can delete option groups" ON option_groups;

CREATE POLICY "option_groups_select" ON option_groups FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "option_groups_insert" ON option_groups FOR INSERT WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY "option_groups_update" ON option_groups FOR UPDATE USING (is_trip_editor(trip_id));
CREATE POLICY "option_groups_delete" ON option_groups FOR DELETE USING (is_trip_editor(trip_id));

-- WEATHER_CACHE: Replace permissive policies with trip-member-scoped
DROP POLICY IF EXISTS "Anyone can view weather cache" ON weather_cache;
DROP POLICY IF EXISTS "Anyone can insert weather cache" ON weather_cache;
DROP POLICY IF EXISTS "Anyone can update weather cache" ON weather_cache;
DROP POLICY IF EXISTS "Anyone can delete weather cache" ON weather_cache;

CREATE POLICY "weather_cache_select" ON weather_cache FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "weather_cache_insert" ON weather_cache FOR INSERT WITH CHECK (is_trip_member(trip_id));
CREATE POLICY "weather_cache_update" ON weather_cache FOR UPDATE USING (is_trip_member(trip_id));
CREATE POLICY "weather_cache_delete" ON weather_cache FOR DELETE USING (is_trip_member(trip_id));

-- TRAVEL_SEGMENTS: Replace permissive policies with trip-member-scoped
DROP POLICY IF EXISTS "Anyone can view travel segments" ON travel_segments;
DROP POLICY IF EXISTS "Anyone can insert travel segments" ON travel_segments;
DROP POLICY IF EXISTS "Anyone can update travel segments" ON travel_segments;
DROP POLICY IF EXISTS "Anyone can delete travel segments" ON travel_segments;

CREATE POLICY "travel_segments_select" ON travel_segments FOR SELECT USING (is_trip_member(trip_id));
CREATE POLICY "travel_segments_insert" ON travel_segments FOR INSERT WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY "travel_segments_update" ON travel_segments FOR UPDATE USING (is_trip_editor(trip_id));
CREATE POLICY "travel_segments_delete" ON travel_segments FOR DELETE USING (is_trip_editor(trip_id));

-- OPTION_IMAGES: Replace permissive policies (join through entry_options -> entries)
DROP POLICY IF EXISTS "Anyone can view option images" ON option_images;
DROP POLICY IF EXISTS "Anyone can insert option images" ON option_images;
DROP POLICY IF EXISTS "Anyone can update option images" ON option_images;
DROP POLICY IF EXISTS "Anyone can delete option images" ON option_images;

CREATE POLICY "option_images_select" ON option_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = option_images.option_id AND is_trip_member(e.trip_id))
);
CREATE POLICY "option_images_insert" ON option_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = option_images.option_id AND is_trip_editor(e.trip_id))
);
CREATE POLICY "option_images_update" ON option_images FOR UPDATE USING (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = option_images.option_id AND is_trip_editor(e.trip_id))
);
CREATE POLICY "option_images_delete" ON option_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = option_images.option_id AND is_trip_editor(e.trip_id))
);

-- VOTES: Replace permissive policies (join through entry_options -> entries)
DROP POLICY IF EXISTS "Anyone can view votes" ON votes;
DROP POLICY IF EXISTS "Anyone can insert votes" ON votes;
DROP POLICY IF EXISTS "Anyone can delete votes" ON votes;

CREATE POLICY "votes_select" ON votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = votes.option_id AND is_trip_member(e.trip_id))
);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = votes.option_id AND is_trip_member(e.trip_id))
);
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (
  EXISTS (SELECT 1 FROM entry_options eo JOIN entries e ON eo.entry_id = e.id WHERE eo.id = votes.option_id AND is_trip_member(e.trip_id))
);

-- STORAGE: Tighten trip-images bucket policies
-- Drop existing permissive storage policies
DROP POLICY IF EXISTS "Anyone can upload trip images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view trip images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update trip images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete trip images" ON storage.objects;
DROP POLICY IF EXISTS "trip-images public read" ON storage.objects;

-- Keep public read (images are referenced by URL throughout the app)
CREATE POLICY "trip_images_select" ON storage.objects FOR SELECT USING (bucket_id = 'trip-images');

-- Require authentication for uploads and deletes
CREATE POLICY "trip_images_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'trip-images' AND auth.uid() IS NOT NULL
);
CREATE POLICY "trip_images_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'trip-images' AND auth.uid() IS NOT NULL
);
CREATE POLICY "trip_images_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'trip-images' AND auth.uid() IS NOT NULL
);
