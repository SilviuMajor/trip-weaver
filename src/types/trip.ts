export interface TripUser {
  id: string;
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
  created_at: string;
}

export interface CategoryPreset {
  name: string;
  color: string;
  emoji?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  timezone: string;
  voting_locked: boolean;
  owner_id: string | null;
  category_presets: CategoryPreset[] | null;
  default_checkin_hours: number;
  default_checkout_min: number;
  emoji: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  trip_id: string;
  start_time: string;
  end_time: string;
  is_locked: boolean;
  is_scheduled: boolean;
  scheduled_day: number | null;
  option_group_id: string | null;
  linked_flight_id: string | null;
  linked_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptionGroup {
  id: string;
  trip_id: string;
  label: string;
  created_at: string;
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
  departure_location: string | null;
  arrival_location: string | null;
  departure_tz: string | null;
  arrival_tz: string | null;
  departure_terminal: string | null;
  arrival_terminal: string | null;
  airport_checkin_hours: number | null;
  airport_checkout_min: number | null;
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

export interface TravelSegment {
  id: string;
  trip_id: string;
  from_entry_id: string;
  to_entry_id: string;
  duration_min: number | null;
  distance_km: number | null;
  mode: string | null;
  polyline: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeatherData {
  id: string;
  trip_id: string;
  date: string;
  hour: number;
  temp_c: number | null;
  condition: string | null;
  icon_code: string | null;
  humidity: number | null;
  wind_speed: number | null;
  created_at: string;
  updated_at: string;
}

export type Timezone = 'UK' | 'Amsterdam';

export interface EntryWithOptions extends Entry {
  options: EntryOption[];
}
