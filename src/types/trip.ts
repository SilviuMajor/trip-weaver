export interface TripUser {
  id: string;
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  voting_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  trip_id: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface EntryOption {
  id: string;
  entry_id: string;
  name: string;
  website: string | null;
  category: string | null;
  category_color: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  vote_count?: number;
  images?: OptionImage[];
}

export interface OptionImage {
  id: string;
  option_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface Vote {
  id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export type Timezone = 'UK' | 'Amsterdam';

export interface EntryWithOptions extends Entry {
  options: EntryOption[];
}
