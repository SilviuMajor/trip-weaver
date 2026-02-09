
-- Add columns to entries table
ALTER TABLE public.entries ADD COLUMN is_scheduled boolean NOT NULL DEFAULT true;
ALTER TABLE public.entries ADD COLUMN scheduled_day integer;
ALTER TABLE public.entries ADD COLUMN option_group_id uuid;

-- Create option_groups table
CREATE TABLE public.option_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from entries to option_groups
ALTER TABLE public.entries ADD CONSTRAINT entries_option_group_id_fkey
  FOREIGN KEY (option_group_id) REFERENCES public.option_groups(id) ON DELETE SET NULL;

-- Enable RLS on option_groups
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for option_groups (same open policies as entries)
CREATE POLICY "Anyone can view option groups" ON public.option_groups FOR SELECT USING (true);
CREATE POLICY "Anyone can insert option groups" ON public.option_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update option groups" ON public.option_groups FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete option groups" ON public.option_groups FOR DELETE USING (true);
