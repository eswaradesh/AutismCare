export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'admin' | 'moderator' | 'user';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          preferred_language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          preferred_language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          preferred_language?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: AppRole
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: AppRole
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: AppRole
          created_at?: string
        }
      }
      child_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          age_years: number
          age_months: number
          communication_level: 'verbal' | 'nonVerbal' | 'limited' | 'developing'
          sensory_preference: 'seeking' | 'avoiding' | 'mixed'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          age_years: number
          age_months: number
          communication_level: 'verbal' | 'nonVerbal' | 'limited' | 'developing'
          sensory_preference: 'seeking' | 'avoiding' | 'mixed'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          age_years?: number
          age_months?: number
          communication_level?: 'verbal' | 'nonVerbal' | 'limited' | 'developing'
          sensory_preference?: 'seeking' | 'avoiding' | 'mixed'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      therapist_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string
          qualification: string
          specialization: string | null
          registration_number: string
          clinic_name: string | null
          contact_email: string | null
          degree_certificate_url: string | null
          license_document_url: string | null
          verification_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          qualification: string
          specialization?: string | null
          registration_number: string
          clinic_name?: string | null
          contact_email?: string | null
          degree_certificate_url?: string | null
          license_document_url?: string | null
          verification_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          qualification?: string
          specialization?: string | null
          registration_number?: string
          clinic_name?: string | null
          contact_email?: string | null
          degree_certificate_url?: string | null
          license_document_url?: string | null
          verification_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      routine_entries: {
        Row: {
          id: string
          user_id: string
          child_id: string | null
          date: string
          type: 'sleep' | 'food' | 'activity' | 'therapy'
          start_time: string | null
          end_time: string | null
          notes: string | null
          voice_note_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          child_id?: string | null
          date: string
          type: 'sleep' | 'food' | 'activity' | 'therapy'
          start_time?: string | null
          end_time?: string | null
          notes?: string | null
          voice_note_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          child_id?: string | null
          date?: string
          type?: 'sleep' | 'food' | 'activity' | 'therapy'
          start_time?: string | null
          end_time?: string | null
          notes?: string | null
          voice_note_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      behavior_entries: {
        Row: {
          id: string
          user_id: string
          child_id: string | null
          date: string
          emotion: string
          intensity: 'low' | 'moderate' | 'high'
          trigger: string | null
          notes: string | null
          is_sudden: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          child_id?: string | null
          date: string
          emotion: string
          intensity: 'low' | 'moderate' | 'high'
          trigger?: string | null
          notes?: string | null
          is_sudden?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          child_id?: string | null
          date?: string
          emotion?: string
          intensity?: 'low' | 'moderate' | 'high'
          trigger?: string | null
          notes?: string | null
          is_sudden?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      medications: {
        Row: {
          id: string
          user_id: string
          child_id: string | null
          name: string
          time: string
          frequency: 'daily' | 'twice-daily' | 'as needed'
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          child_id?: string | null
          name: string
          time: string
          frequency: 'daily' | 'twice-daily' | 'as needed'
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          child_id?: string | null
          name?: string
          time?: string
          frequency?: 'daily' | 'twice-daily' | 'as needed'
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      daily_summaries: {
        Row: {
          id: string
          user_id: string
          child_id: string | null
          date: string
          sleep_quality: string | null
          mood_overview: string | null
          highlights: string[] | null
          positive_notes: string | null
          generated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          child_id?: string | null
          date: string
          sleep_quality?: string | null
          mood_overview?: string | null
          highlights?: string[] | null
          positive_notes?: string | null
          generated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          child_id?: string | null
          date?: string
          sleep_quality?: string | null
          mood_overview?: string | null
          highlights?: string[] | null
          positive_notes?: string | null
          generated_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      shared_reports: {
        Row: {
          id: string
          user_id: string
          child_id: string | null
          share_token: string
          report_type: string
          date_range_start: string
          date_range_end: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          child_id?: string | null
          share_token: string
          report_type: string
          date_range_start: string
          date_range_end: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          child_id?: string | null
          share_token?: string
          report_type?: string
          date_range_start?: string
          date_range_end?: string
          expires_at?: string
          created_at?: string
        }
      }
      therapist_notes: {
        Row: {
          id: string
          therapist_id: string
          child_id: string
          parent_id: string
          note_text: string
          note_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          therapist_id: string
          child_id: string
          parent_id: string
          note_text: string
          note_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          therapist_id?: string
          child_id?: string
          parent_id?: string
          note_text?: string
          note_type?: string
          created_at?: string
          updated_at?: string
        }
      }
      behavior_intensity_alerts: {
        Row: {
          id: string
          parent_id: string
          child_id: string
          therapist_id: string
          consecutive_high_count: number
          last_high_entry_id: string | null
          alert_sent_at: string | null
          acknowledged: boolean
          created_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          child_id: string
          therapist_id: string
          consecutive_high_count: number
          last_high_entry_id?: string | null
          alert_sent_at?: string | null
          acknowledged?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          child_id?: string
          therapist_id?: string
          consecutive_high_count?: number
          last_high_entry_id?: string | null
          alert_sent_at?: string | null
          acknowledged?: boolean
          created_at?: string
        }
      }
      therapist_activity_suggestions: {
        Row: {
          id: string
          therapist_id: string
          parent_id: string
          child_id: string
          title: string
          description: string | null
          related_pattern: string | null
          suggested_frequency: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          therapist_id: string
          parent_id: string
          child_id: string
          title: string
          description?: string | null
          related_pattern?: string | null
          suggested_frequency?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          therapist_id?: string
          parent_id?: string
          child_id?: string
          title?: string
          description?: string | null
          related_pattern?: string | null
          suggested_frequency?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      parent_therapist_relationships: {
        Row: {
          id: string
          parent_id: string
          therapist_id: string
          child_id: string | null
          status: string
          access_routines: boolean
          access_behaviors: boolean
          access_summaries: boolean
          access_reports: boolean
          access_medications: boolean
          access_expires_at: string | null
          invited_by: string | null
          invited_at: string
          accepted_at: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          id?: string
          parent_id: string
          therapist_id: string
          child_id?: string | null
          status?: string
          access_routines?: boolean
          access_behaviors?: boolean
          access_summaries?: boolean
          access_reports?: boolean
          access_medications?: boolean
          access_expires_at?: string | null
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          id?: string
          parent_id?: string
          therapist_id?: string
          child_id?: string | null
          status?: string
          access_routines?: boolean
          access_behaviors?: boolean
          access_summaries?: boolean
          access_reports?: boolean
          access_medications?: boolean
          access_expires_at?: string | null
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
      }
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: AppRole
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: AppRole
      communication_level: 'verbal' | 'nonVerbal' | 'limited' | 'developing'
      sensory_preference: 'seeking' | 'avoiding' | 'mixed'
      routine_type: 'sleep' | 'food' | 'activity' | 'therapy'
      medication_frequency: 'daily' | 'twice-daily' | 'as needed'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
