ALTER TABLE public.entries
  ADD COLUMN from_entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE,
  ADD COLUMN to_entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE;