export interface TripUser {
  id: string;
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
  pin_hash?: string | null;
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
  home_timezone: string;
  voting_locked: boolean;
  owner_id: string | null;
  category_presets: CategoryPreset[] | null;
  default_checkin_hours: number;
  default_checkout_min: number;
  emoji: string | null;
  image_url: string | null;
  walk_threshold_min: number;
  default_transport_mode: string;
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
  from_entry_id: string | null;
  to_entry_id: string | null;
  created_at: string;
  updated_at: string;
  notes?: string | null;
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
  phone: string | null;
  address: string | null;
  rating: number | null;
  user_rating_count: number | null;
  opening_hours: string[] | null;
  google_maps_uri: string | null;
  google_place_id: string | null;
  price_level: string | null;
  created_at: string;
  updated_at: string;
  vote_count?: number;
  images?: OptionImage[];
  transport_modes?: TransportMode[] | null;
  hotel_id?: string | null;
}

export interface TransportMode {
  mode: string;
  duration_min: number;
  distance_km: number;
  polyline?: string | null;
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
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface Hotel {
  id: string;
  trip_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  user_rating_count: number | null;
  google_place_id: string | null;
  google_maps_uri: string | null;
  check_in_date: string | null;
  check_in_time: string | null;
  checkout_date: string | null;
  checkout_time: string | null;
  evening_return: string | null;
  morning_leave: string | null;
  created_at: string;
  updated_at: string;
}

export type Timezone = 'UK' | 'Amsterdam';

export interface EntryWithOptions extends Entry {
  options: EntryOption[];
}
