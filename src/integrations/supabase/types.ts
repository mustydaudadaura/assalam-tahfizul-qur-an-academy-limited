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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          absent: number
          created_at: string
          id: string
          present: number
          session_id: string
          student_id: string
          term_id: string
          total_days: number
        }
        Insert: {
          absent?: number
          created_at?: string
          id?: string
          present?: number
          session_id: string
          student_id: string
          term_id: string
          total_days?: number
        }
        Update: {
          absent?: number
          created_at?: string
          id?: string
          present?: number
          session_id?: string
          student_id?: string
          term_id?: string
          total_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_daily: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          session_id: string
          status: string
          student_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          session_id: string
          status?: string
          student_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          session_id?: string
          status?: string
          student_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          id: string
          level: string | null
          name: string
          section: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string | null
          name: string
          section?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          section?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          ca1: number
          ca2: number
          class_id: string
          created_at: string
          entered_by: string | null
          exam: number
          grade: string | null
          id: string
          session_id: string
          student_id: string
          subject_id: string
          term_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          ca1?: number
          ca2?: number
          class_id: string
          created_at?: string
          entered_by?: string | null
          exam?: number
          grade?: string | null
          id?: string
          session_id: string
          student_id: string
          subject_id: string
          term_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          ca1?: number
          ca2?: number
          class_id?: string
          created_at?: string
          entered_by?: string | null
          exam?: number
          grade?: string | null
          id?: string
          session_id?: string
          student_id?: string
          subject_id?: string
          term_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          address: string | null
          email: string | null
          id: number
          logo_url: string | null
          motto: string | null
          phone: string | null
          principal_name: string | null
          principal_signature_url: string | null
          school_name: string
          secondary_logo_url: string | null
          section_label: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          motto?: string | null
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          school_name?: string
          secondary_logo_url?: string | null
          section_label?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          motto?: string | null
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          school_name?: string
          secondary_logo_url?: string | null
          section_label?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          name?: string
        }
        Relationships: []
      }
      student_term_reports: {
        Row: {
          affective: Json | null
          class_teacher_remark: string | null
          created_at: string
          head_name: string | null
          head_signature_url: string | null
          id: string
          next_term_begins: string | null
          principal_remark: string | null
          promotion_status: string | null
          psychomotor: Json | null
          serial_no: string | null
          student_id: string
          teacher_name: string | null
          teacher_signature_url: string | null
          term_id: string
          updated_at: string
        }
        Insert: {
          affective?: Json | null
          class_teacher_remark?: string | null
          created_at?: string
          head_name?: string | null
          head_signature_url?: string | null
          id?: string
          next_term_begins?: string | null
          principal_remark?: string | null
          promotion_status?: string | null
          psychomotor?: Json | null
          serial_no?: string | null
          student_id: string
          teacher_name?: string | null
          teacher_signature_url?: string | null
          term_id: string
          updated_at?: string
        }
        Update: {
          affective?: Json | null
          class_teacher_remark?: string | null
          created_at?: string
          head_name?: string | null
          head_signature_url?: string | null
          id?: string
          next_term_begins?: string | null
          principal_remark?: string | null
          promotion_status?: string | null
          psychomotor?: Json | null
          serial_no?: string | null
          student_id?: string
          teacher_name?: string | null
          teacher_signature_url?: string | null
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_term_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_term_reports_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_no: string
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          house: string | null
          id: string
          passport_url: string | null
          user_id: string | null
        }
        Insert: {
          admission_no: string
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          house?: string | null
          id?: string
          passport_url?: string | null
          user_id?: string | null
        }
        Update: {
          admission_no?: string
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          house?: string | null
          id?: string
          passport_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          id: string
          max_score: number | null
          name: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          name: string
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          name?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          name: string
          session_id: string
          term_begins: string | null
          term_ends: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          name: string
          session_id: string
          term_begins?: string | null
          term_ends?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          name?: string
          session_id?: string
          term_begins?: string | null
          term_ends?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
      calc_grade: { Args: { _total: number }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "student"
        | "super_admin"
        | "cashier"
        | "accountant"
        | "parent"
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
      app_role: [
        "admin",
        "teacher",
        "student",
        "super_admin",
        "cashier",
        "accountant",
        "parent",
      ],
    },
  },
} as const
