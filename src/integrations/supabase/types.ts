export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      database: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string | null
          device_id: string
          device_name: string
          device_type: string
          id: string
          is_active: boolean | null
          last_connected_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          device_name: string
          device_type: string
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          device_name?: string
          device_type?: string
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          body: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          metadata: Json | null
          next_retry_at: string | null
          retries: number
          retry_count: number | null
          status: string
          subject: string
          to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          next_retry_at?: string | null
          retries?: number
          retry_count?: number | null
          status?: string
          subject: string
          to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          next_retry_at?: string | null
          retries?: number
          retry_count?: number | null
          status?: string
          subject?: string
          to?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_inventory: {
        Row: {
          created_at: string | null
          current_quantity: number
          dose_amount: number
          id: string
          last_refill_date: string | null
          last_refill_quantity: number | null
          last_updated: string | null
          max_quantity: number | null
          medication_id: string
          refill_threshold: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_quantity?: number
          dose_amount?: number
          id?: string
          last_refill_date?: string | null
          last_refill_quantity?: number | null
          last_updated?: string | null
          max_quantity?: number | null
          medication_id: string
          refill_threshold?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_quantity?: number
          dose_amount?: number
          id?: string
          last_refill_date?: string | null
          last_refill_quantity?: number | null
          last_updated?: string | null
          max_quantity?: number | null
          medication_id?: string
          refill_threshold?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_inventory_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          created_at: string | null
          dosage_taken: number | null
          dosage_unit: string | null
          id: string
          medication_id: string
          medication_name: string | null
          notes: string | null
          reason: string | null
          scheduled_time: string
          status: string
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dosage_taken?: number | null
          dosage_unit?: string | null
          id?: string
          medication_id: string
          medication_name?: string | null
          notes?: string | null
          reason?: string | null
          scheduled_time: string
          status: string
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dosage_taken?: number | null
          dosage_unit?: string | null
          id?: string
          medication_id?: string
          medication_name?: string | null
          notes?: string | null
          reason?: string | null
          scheduled_time?: string
          status?: string
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_refill_logs: {
        Row: {
          created_at: string | null
          id: string
          medication_id: string
          notes: string | null
          quantity: number
          refill_date: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          medication_id: string
          notes?: string | null
          quantity: number
          refill_date?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          medication_id?: string
          notes?: string | null
          quantity?: number
          refill_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_refill_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          created_at: string | null
          id: string
          last_taken_at: string | null
          medication_id: string
          missed_doses: boolean | null
          next_dose: string
          next_reminder_at: string | null
          scheduled_time: string
          taken: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_taken_at?: string | null
          medication_id: string
          missed_doses?: boolean | null
          next_dose: string
          next_reminder_at?: string | null
          scheduled_time: string
          taken?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_taken_at?: string | null
          medication_id?: string
          missed_doses?: boolean | null
          next_dose?: string
          next_reminder_at?: string | null
          scheduled_time?: string
          taken?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_streaks: {
        Row: {
          created_at: string | null
          current_streak: number | null
          id: string
          last_taken_at: string | null
          longest_streak: number | null
          medication_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_taken_at?: string | null
          longest_streak?: number | null
          medication_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_taken_at?: string | null
          longest_streak?: number | null
          medication_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_streaks_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string | null
          dosage: string
          frequency: string
          id: string
          instructions: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dosage: string
          frequency?: string
          id?: string
          instructions?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dosage?: string
          frequency?: string
          id?: string
          instructions?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_entries: {
        Row: {
          created_at: string | null
          date: string
          id: string
          mood: number
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          mood: number
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          mood?: number
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          content: Json | null
          created_at: string | null
          delivered: boolean | null
          delivery_details: Json | null
          id: string
          medication_id: string | null
          notification_type: string
          priority_level: string | null
          request_id: string | null
          scheduled_time: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          delivered?: boolean | null
          delivery_details?: Json | null
          id?: string
          medication_id?: string | null
          notification_type: string
          priority_level?: string | null
          request_id?: string | null
          scheduled_time?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          delivered?: boolean | null
          delivery_details?: Json | null
          id?: string
          medication_id?: string | null
          notification_type?: string
          priority_level?: string | null
          request_id?: string | null
          scheduled_time?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          medication_schedule_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          medication_schedule_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          medication_schedule_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_medication_schedule_id_fkey"
            columns: ["medication_schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          phone_number: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          phone_number?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      sms_queue: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          phone: string
          sent_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          phone: string
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          phone?: string
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_endpoint: string | null
          device_id: string | null
          device_name: string | null
          device_token: string | null
          device_type: string | null
          id: string
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_endpoint?: string | null
          device_id?: string | null
          device_name?: string | null
          device_token?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_endpoint?: string | null
          device_id?: string | null
          device_name?: string | null
          device_token?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_user_devices: {
        Row: {
          created_at: string | null
          device_endpoint: string | null
          device_id: string | null
          device_name: string | null
          device_token: string | null
          device_type: string | null
          id: string | null
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_endpoint?: string | null
          device_id?: string | null
          device_name?: string | null
          device_token?: string | null
          device_type?: string | null
          id?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_endpoint?: string | null
          device_id?: string | null
          device_name?: string | null
          device_token?: string | null
          device_type?: string | null
          id?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_mark_missed_doses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      calculate_next_dose: {
        Args: { p_current_time: string; p_scheduled_time: string }
        Returns: string
      }
      calculate_next_reminder: {
        Args: { p_frequency: string; p_last_taken: string }
        Returns: string
      }
      generate_medication_schedules: {
        Args: {
          medication_id: string
          first_dose_time: string
          frequency: string
        }
        Returns: undefined
      }
      get_today_stats: {
        Args: { user_id: string }
        Returns: {
          taken_count: number
          missed_count: number
          skipped_count: number
          upcoming_count: number
          overdue_count: number
        }[]
      }
      get_upcoming_doses: {
        Args: { user_id: string; limit_count?: number }
        Returns: {
          medication_id: string
          medication_name: string
          medication_dosage: string
          medication_instructions: string
          next_dose_time: string
          status: string
        }[]
      }
      get_weekly_adherence: {
        Args: { user_id: string }
        Returns: {
          day_name: string
          day_date: string
          taken_count: number
          missed_count: number
          skipped_count: number
          total_count: number
        }[]
      }
      mark_dose_as_skipped: {
        Args: { p_medication_id: string; p_scheduled_time?: string }
        Returns: undefined
      }
      mark_dose_as_taken: {
        Args: { p_medication_id: string; p_scheduled_time?: string }
        Returns: undefined
      }
      process_email_queue: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      register_esp32_device: {
        Args: {
          p_user_id: string
          p_device_id: string
          p_device_token: string
          p_device_name?: string
        }
        Returns: string
      }
      update_medication_inventory: {
        Args: { p_medication_id: string; p_new_quantity: number }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
