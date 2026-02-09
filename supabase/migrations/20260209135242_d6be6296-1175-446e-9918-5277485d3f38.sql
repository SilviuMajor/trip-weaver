
-- Add locking and linked entry columns to entries
ALTER TABLE public.entries ADD COLUMN is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.entries ADD COLUMN linked_flight_id uuid REFERENCES public.entries(id) ON DELETE CASCADE;
ALTER TABLE public.entries ADD COLUMN linked_type text;

-- Add airport processing fields to entry_options
ALTER TABLE public.entry_options ADD COLUMN airport_checkin_hours numeric DEFAULT 2;
ALTER TABLE public.entry_options ADD COLUMN airport_checkout_min integer DEFAULT 30;

-- Add trip-level default processing times
ALTER TABLE public.trips ADD COLUMN default_checkin_hours numeric NOT NULL DEFAULT 2;
ALTER TABLE public.trips ADD COLUMN default_checkout_min integer NOT NULL DEFAULT 30;
