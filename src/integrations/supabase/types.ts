export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      entries: {
        Row: {
          created_at: string
          end_time: string
          from_entry_id: string | null
          id: string
          is_locked: boolean
          is_scheduled: boolean
          linked_flight_id: string | null
          linked_type: string | null
          notes: string | null
          option_group_id: string | null
          scheduled_day: number | null
          start_time: string
          to_entry_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          from_entry_id?: string | null
          id?: string
          is_locked?: boolean
          is_scheduled?: boolean
          linked_flight_id?: string | null
          linked_type?: string | null
          notes?: string | null
          option_group_id?: string | null
          scheduled_day?: number | null
          start_time: string
          to_entry_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          from_entry_id?: string | null
          id?: string
          is_locked?: boolean
          is_scheduled?: boolean
          linked_flight_id?: string | null
          linked_type?: string | null
          notes?: string | null
          option_group_id?: string | null
          scheduled_day?: number | null
          start_time?: string
          to_entry_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_from_entry_id_fkey"
            columns: ["from_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_linked_flight_id_fkey"
            columns: ["linked_flight_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_to_entry_id_fkey"
            columns: ["to_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_options: {
        Row: {
          address: string | null
          airport_checkin_hours: number | null
          airport_checkout_min: number | null
          arrival_location: string | null
          arrival_terminal: string | null
          arrival_tz: string | null
          category: string | null
          category_color: string | null
          created_at: string
          departure_location: string | null
          departure_terminal: string | null
          departure_tz: string | null
          distance_km: number | null
          entry_id: string
          google_maps_uri: string | null
          google_place_id: string | null
          hotel_id: string | null
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string | null
          price_level: string | null
          rating: number | null
          route_polyline: string | null
          transport_modes: Json | null
          updated_at: string
          user_rating_count: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          airport_checkin_hours?: number | null
          airport_checkout_min?: number | null
          arrival_location?: string | null
          arrival_terminal?: string | null
          arrival_tz?: string | null
          category?: string | null
          category_color?: string | null
          created_at?: string
          departure_location?: string | null
          departure_terminal?: string | null
          departure_tz?: string | null
          distance_km?: number | null
          entry_id: string
          google_maps_uri?: string | null
          google_place_id?: string | null
          hotel_id?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          price_level?: string | null
          rating?: number | null
          route_polyline?: string | null
          transport_modes?: Json | null
          updated_at?: string
          user_rating_count?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          airport_checkin_hours?: number | null
          airport_checkout_min?: number | null
          arrival_location?: string | null
          arrival_terminal?: string | null
          arrival_tz?: string | null
          category?: string | null
          category_color?: string | null
          created_at?: string
          departure_location?: string | null
          departure_terminal?: string | null
          departure_tz?: string | null
          distance_km?: number | null
          entry_id?: string
          google_maps_uri?: string | null
          google_place_id?: string | null
          hotel_id?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          price_level?: string | null
          rating?: number | null
          route_polyline?: string | null
          transport_modes?: Json | null
          updated_at?: string
          user_rating_count?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_options_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_options_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          check_in_date: string | null
          check_in_time: string | null
          checkout_date: string | null
          checkout_time: string | null
          created_at: string
          evening_return: string | null
          google_maps_uri: string | null
          google_place_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          morning_leave: string | null
          name: string
          phone: string | null
          rating: number | null
          trip_id: string
          updated_at: string
          user_rating_count: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          check_in_date?: string | null
          check_in_time?: string | null
          checkout_date?: string | null
          checkout_time?: string | null
          created_at?: string
          evening_return?: string | null
          google_maps_uri?: string | null
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          morning_leave?: string | null
          name: string
          phone?: string | null
          rating?: number | null
          trip_id: string
          updated_at?: string
          user_rating_count?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          check_in_date?: string | null
          check_in_time?: string | null
          checkout_date?: string | null
          checkout_time?: string | null
          created_at?: string
          evening_return?: string | null
          google_maps_uri?: string | null
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          morning_leave?: string | null
          name?: string
          phone?: string | null
          rating?: number | null
          trip_id?: string
          updated_at?: string
          user_rating_count?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotels_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          created_at: string
          id: string
          label: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      option_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          option_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          option_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_images_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "entry_options"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      travel_segments: {
        Row: {
          created_at: string
          distance_km: number | null
          duration_min: number | null
          from_entry_id: string
          id: string
          mode: string | null
          polyline: string | null
          to_entry_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          from_entry_id: string
          id?: string
          mode?: string | null
          polyline?: string | null
          to_entry_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          from_entry_id?: string
          id?: string
          mode?: string | null
          polyline?: string | null
          to_entry_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_segments_from_entry_id_fkey"
            columns: ["from_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_segments_to_entry_id_fkey"
            columns: ["to_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_users: {
        Row: {
          created_at: string
          id: string
          name: string
          pin_hash: string | null
          role: string
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pin_hash?: string | null
          role?: string
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pin_hash?: string | null
          role?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_users_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          category_presets: Json | null
          created_at: string
          default_checkin_hours: number
          default_checkout_min: number
          destination: string | null
          duration_days: number | null
          emoji: string | null
          end_date: string | null
          home_timezone: string
          id: string
          image_url: string | null
          name: string
          owner_id: string | null
          start_date: string | null
          updated_at: string
          voting_locked: boolean
          walk_threshold_min: number
        }
        Insert: {
          category_presets?: Json | null
          created_at?: string
          default_checkin_hours?: number
          default_checkout_min?: number
          destination?: string | null
          duration_days?: number | null
          emoji?: string | null
          end_date?: string | null
          home_timezone?: string
          id?: string
          image_url?: string | null
          name: string
          owner_id?: string | null
          start_date?: string | null
          updated_at?: string
          voting_locked?: boolean
          walk_threshold_min?: number
        }
        Update: {
          category_presets?: Json | null
          created_at?: string
          default_checkin_hours?: number
          default_checkout_min?: number
          destination?: string | null
          duration_days?: number | null
          emoji?: string | null
          end_date?: string | null
          home_timezone?: string
          id?: string
          image_url?: string | null
          name?: string
          owner_id?: string | null
          start_date?: string | null
          updated_at?: string
          voting_locked?: boolean
          walk_threshold_min?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "entry_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "trip_users"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          condition: string | null
          created_at: string
          date: string
          hour: number
          humidity: number | null
          icon_code: string | null
          id: string
          latitude: number | null
          longitude: number | null
          temp_c: number | null
          trip_id: string
          updated_at: string
          wind_speed: number | null
        }
        Insert: {
          condition?: string | null
          created_at?: string
          date: string
          hour: number
          humidity?: number | null
          icon_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          temp_c?: number | null
          trip_id: string
          updated_at?: string
          wind_speed?: number | null
        }
        Update: {
          condition?: string | null
          created_at?: string
          date?: string
          hour?: number
          humidity?: number | null
          icon_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          temp_c?: number | null
          trip_id?: string
          updated_at?: string
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_cache_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
