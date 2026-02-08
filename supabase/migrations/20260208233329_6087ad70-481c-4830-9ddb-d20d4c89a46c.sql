
ALTER TABLE public.trips
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL,
  ADD COLUMN duration_days integer;
