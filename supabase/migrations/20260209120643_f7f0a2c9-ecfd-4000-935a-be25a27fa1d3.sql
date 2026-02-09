
ALTER TABLE public.entry_options ADD COLUMN departure_location text;
ALTER TABLE public.entry_options ADD COLUMN arrival_location text;
ALTER TABLE public.entry_options ADD COLUMN departure_tz text;
ALTER TABLE public.entry_options ADD COLUMN arrival_tz text;
