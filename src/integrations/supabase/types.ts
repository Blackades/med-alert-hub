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
          created_at: string
          id: string
          medication_id: string
          scheduled_time: string
          status: string
          taken_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          scheduled_time: string
          status: string
          taken_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          scheduled_time?: string
          status?: string
          taken_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_mark_missed_doses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      calculate_next_dose: {
        Args: {
          p_current_time: string
          p_scheduled_time: string
        }
        Returns: string
      }
      calculate_next_reminder: {
        Args: {
          p_frequency: string
          p_last_taken: string
        }
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
        Args: {
          user_id: string
        }
        Returns: {
          taken_count: number
          missed_count: number
          skipped_count: number
          upcoming_count: number
          overdue_count: number
        }[]
      }
      get_upcoming_doses: {
        Args: {
          user_id: string
          limit_count?: number
        }
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
        Args: {
          user_id: string
        }
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
        Args: {
          p_medication_id: string
          p_scheduled_time?: string
        }
        Returns: undefined
      }
      mark_dose_as_taken: {
        Args: {
          p_medication_id: string
          p_scheduled_time?: string
        }
        Returns: undefined
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
