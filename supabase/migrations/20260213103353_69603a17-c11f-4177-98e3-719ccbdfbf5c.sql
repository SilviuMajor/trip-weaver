ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS user_rating_count integer;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS opening_hours jsonb;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS google_maps_uri text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS price_level text;