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
      cloudbeds_sync_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          property_id: string
          reservations_created: number | null
          reservations_processed: number | null
          reservations_updated: number | null
          run_type: string
          started_at: string
          status: string
          transport_requests_cancelled: number | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          property_id: string
          reservations_created?: number | null
          reservations_processed?: number | null
          reservations_updated?: number | null
          run_type?: string
          started_at?: string
          status?: string
          transport_requests_cancelled?: number | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          property_id?: string
          reservations_created?: number | null
          reservations_processed?: number | null
          reservations_updated?: number | null
          run_type?: string
          started_at?: string
          status?: string
          transport_requests_cancelled?: number | null
        }
        Relationships: []
      }
      cloudbeds_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          property_id: string
          reservation_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          property_id: string
          reservation_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          property_id?: string
          reservation_id?: string | null
        }
        Relationships: []
      }
      notification_attempts: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          is_fallback: boolean
          metadata: Json | null
          notification_type: string
          provider_message_id: string | null
          recipient_email: string | null
          recipient_phone: string | null
          status: string
          template_sid: string | null
          transport_request_id: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_fallback?: boolean
          metadata?: Json | null
          notification_type: string
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          status?: string
          template_sid?: string | null
          transport_request_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_fallback?: boolean
          metadata?: Json | null
          notification_type?: string
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          status?: string
          template_sid?: string | null
          transport_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_attempts_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          check_in_date: string
          check_out_date: string | null
          cloudbeds_raw: Json | null
          created_at: string
          guest_country_code: string | null
          guest_first_name: string | null
          guest_last_name: string
          id: string
          nights: number | null
          property_id: string
          reservation_id: string
          riad_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          check_in_date: string
          check_out_date?: string | null
          cloudbeds_raw?: Json | null
          created_at?: string
          guest_country_code?: string | null
          guest_first_name?: string | null
          guest_last_name: string
          id?: string
          nights?: number | null
          property_id: string
          reservation_id: string
          riad_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          check_in_date?: string
          check_out_date?: string | null
          cloudbeds_raw?: Json | null
          created_at?: string
          guest_country_code?: string | null
          guest_first_name?: string | null
          guest_last_name?: string
          id?: string
          nights?: number | null
          property_id?: string
          reservation_id?: string
          riad_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_riad_id_fkey"
            columns: ["riad_id"]
            isOneToOne: false
            referencedRelation: "riads"
            referencedColumns: ["id"]
          },
        ]
      }
      riad_transport_offers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          override_base_pax: number | null
          override_day_price: number | null
          override_extra_pax_price: number | null
          override_night_price: number | null
          override_payment_mode:
            | Database["public"]["Enums"]["payment_mode"]
            | null
          riad_id: string
          transport_offer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          override_base_pax?: number | null
          override_day_price?: number | null
          override_extra_pax_price?: number | null
          override_night_price?: number | null
          override_payment_mode?:
            | Database["public"]["Enums"]["payment_mode"]
            | null
          riad_id: string
          transport_offer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          override_base_pax?: number | null
          override_day_price?: number | null
          override_extra_pax_price?: number | null
          override_night_price?: number | null
          override_payment_mode?:
            | Database["public"]["Enums"]["payment_mode"]
            | null
          riad_id?: string
          transport_offer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riad_transport_offers_riad_id_fkey"
            columns: ["riad_id"]
            isOneToOne: false
            referencedRelation: "riads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riad_transport_offers_transport_offer_id_fkey"
            columns: ["transport_offer_id"]
            isOneToOne: false
            referencedRelation: "transport_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      riads: {
        Row: {
          cloudbeds_property_id: string | null
          cloudbeds_sync_enabled: boolean
          created_at: string
          id: string
          is_active: boolean
          manager_email: string | null
          manager_whatsapp: string | null
          name: string
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          cloudbeds_property_id?: string | null
          cloudbeds_sync_enabled?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          manager_email?: string | null
          manager_whatsapp?: string | null
          name: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          cloudbeds_property_id?: string | null
          cloudbeds_sync_enabled?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          manager_email?: string | null
          manager_whatsapp?: string | null
          name?: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      transport_offers: {
        Row: {
          created_at: string
          day_end_time: string
          day_start_time: string
          default_base_pax: number
          default_day_price: number
          default_extra_pax_price: number
          default_night_price: number
          default_payment_mode: Database["public"]["Enums"]["payment_mode"]
          fields_schema: Json | null
          id: string
          is_active: boolean
          name: string
          name_fr: string | null
          type: Database["public"]["Enums"]["transport_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_end_time?: string
          day_start_time?: string
          default_base_pax?: number
          default_day_price: number
          default_extra_pax_price?: number
          default_night_price: number
          default_payment_mode?: Database["public"]["Enums"]["payment_mode"]
          fields_schema?: Json | null
          id?: string
          is_active?: boolean
          name: string
          name_fr?: string | null
          type: Database["public"]["Enums"]["transport_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_end_time?: string
          day_start_time?: string
          default_base_pax?: number
          default_day_price?: number
          default_extra_pax_price?: number
          default_night_price?: number
          default_payment_mode?: Database["public"]["Enums"]["payment_mode"]
          fields_schema?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          name_fr?: string | null
          type?: Database["public"]["Enums"]["transport_type"]
          updated_at?: string
        }
        Relationships: []
      }
      transport_requests: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          computed_price: number
          created_at: string
          guest_comment: string | null
          id: string
          is_free_transfer: boolean
          pax: number
          payload_details: Json | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          public_token: string | null
          rejection_reason: string | null
          reservation_id: string
          riad_id: string
          status: Database["public"]["Enums"]["request_status"]
          transport_date: string
          transport_offer_id: string
          transport_time: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          computed_price: number
          created_at?: string
          guest_comment?: string | null
          id?: string
          is_free_transfer?: boolean
          pax: number
          payload_details?: Json | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          public_token?: string | null
          rejection_reason?: string | null
          reservation_id: string
          riad_id: string
          status?: Database["public"]["Enums"]["request_status"]
          transport_date: string
          transport_offer_id: string
          transport_time: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          computed_price?: number
          created_at?: string
          guest_comment?: string | null
          id?: string
          is_free_transfer?: boolean
          pax?: number
          payload_details?: Json | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          public_token?: string | null
          rejection_reason?: string | null
          reservation_id?: string
          riad_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          transport_date?: string
          transport_offer_id?: string
          transport_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "transport_requests_riad_id_fkey"
            columns: ["riad_id"]
            isOneToOne: false
            referencedRelation: "riads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_transport_offer_id_fkey"
            columns: ["transport_offer_id"]
            isOneToOne: false
            referencedRelation: "transport_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_riads: {
        Row: {
          created_at: string
          id: string
          riad_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          riad_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          riad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_riads_riad_id_fkey"
            columns: ["riad_id"]
            isOneToOne: false
            referencedRelation: "riads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_transport_request_public: {
        Args: {
          _computed_price: number
          _guest_comment?: string
          _is_free_transfer?: boolean
          _pax: number
          _payload_details?: Json
          _payment_mode: Database["public"]["Enums"]["payment_mode"]
          _reservation_id: string
          _riad_id: string
          _transport_date: string
          _transport_offer_id: string
          _transport_time: string
        }
        Returns: string
      }
      get_public_riad: {
        Args: { _riad_id: string }
        Returns: {
          cloudbeds_property_id: string
          id: string
          is_active: boolean
          name: string
          whatsapp_enabled: boolean
        }[]
      }
      get_public_riads: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          name: string
          whatsapp_enabled: boolean
        }[]
      }
      get_transport_request_by_reservation: {
        Args: { _reservation_id: string }
        Returns: {
          computed_price: number
          id: string
          pax: number
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          status: Database["public"]["Enums"]["request_status"]
          transport_date: string
          transport_offer_id: string
          transport_time: string
        }[]
      }
      get_transport_request_by_token: {
        Args: { _token: string }
        Returns: {
          computed_price: number
          guest_comment: string
          id: string
          is_free_transfer: boolean
          pax: number
          payload_details: Json
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          property_name: string
          reservation_id: string
          status: Database["public"]["Enums"]["request_status"]
          transport_date: string
          transport_name: string
          transport_offer_id: string
          transport_time: string
          transport_type: string
        }[]
      }
      has_riad_access: {
        Args: { _riad_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      lookup_reservation_public: {
        Args: {
          _check_in_date: string
          _reservation_id: string
          _riad_id: string
        }
        Returns: {
          check_in_date: string
          guest_first_name: string
          guest_last_name: string
          reservation_id: string
          riad_id: string
          riad_name: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
      validate_reservation_exists: {
        Args: { _property_id?: string; _reservation_id: string }
        Returns: {
          check_in_date: string
          exists_flag: boolean
          riad_id: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "manager" | "pending"
      payment_mode: "at_riad" | "to_driver"
      request_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "canceled_due_to_reservation"
        | "cancelled"
      reservation_status:
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "canceled"
        | "no_show"
      transport_type:
        | "airport_pickup"
        | "train_station_pickup"
        | "hotel_pickup"
        | "bus_station_pickup"
        | "port_pickup"
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
      app_role: ["super_admin", "manager", "pending"],
      payment_mode: ["at_riad", "to_driver"],
      request_status: [
        "pending",
        "confirmed",
        "rejected",
        "canceled_due_to_reservation",
        "cancelled",
      ],
      reservation_status: [
        "confirmed",
        "checked_in",
        "checked_out",
        "canceled",
        "no_show",
      ],
      transport_type: [
        "airport_pickup",
        "train_station_pickup",
        "hotel_pickup",
        "bus_station_pickup",
        "port_pickup",
      ],
    },
  },
} as const
