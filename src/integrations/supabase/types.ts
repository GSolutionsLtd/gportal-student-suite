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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academic_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cbt_answers: {
        Row: {
          answered_at: string | null
          attempt_id: string
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          selected_answer: string | null
        }
        Insert: {
          answered_at?: string | null
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          selected_answer?: string | null
        }
        Update: {
          answered_at?: string | null
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          selected_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cbt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "cbt_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      cbt_attempts: {
        Row: {
          created_at: string | null
          exam_id: string
          id: string
          percentage: number | null
          score: number | null
          started_at: string | null
          status: string | null
          student_id: string
          submitted_at: string | null
          time_spent_seconds: number | null
          total_marks: number | null
        }
        Insert: {
          created_at?: string | null
          exam_id: string
          id?: string
          percentage?: number | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          student_id: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          total_marks?: number | null
        }
        Update: {
          created_at?: string | null
          exam_id?: string
          id?: string
          percentage?: number | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          total_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cbt_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "cbt_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbt_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cbt_exam_questions: {
        Row: {
          exam_id: string
          id: string
          question_id: string
          sort_order: number | null
        }
        Insert: {
          exam_id: string
          id?: string
          question_id: string
          sort_order?: number | null
        }
        Update: {
          exam_id?: string
          id?: string
          question_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cbt_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "cbt_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbt_exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      cbt_exams: {
        Row: {
          class_arm_id: string
          created_at: string | null
          created_by: string
          duration_minutes: number
          end_time: string | null
          exam_type: string
          id: string
          max_attempts: number | null
          pass_mark: number | null
          question_bank_id: string | null
          show_result_immediately: boolean | null
          shuffle_options: boolean | null
          shuffle_questions: boolean | null
          start_time: string | null
          status: string | null
          subject_id: string
          term_id: string
          title: string
          total_marks: number
          updated_at: string | null
        }
        Insert: {
          class_arm_id: string
          created_at?: string | null
          created_by: string
          duration_minutes?: number
          end_time?: string | null
          exam_type?: string
          id?: string
          max_attempts?: number | null
          pass_mark?: number | null
          question_bank_id?: string | null
          show_result_immediately?: boolean | null
          shuffle_options?: boolean | null
          shuffle_questions?: boolean | null
          start_time?: string | null
          status?: string | null
          subject_id: string
          term_id: string
          title: string
          total_marks?: number
          updated_at?: string | null
        }
        Update: {
          class_arm_id?: string
          created_at?: string | null
          created_by?: string
          duration_minutes?: number
          end_time?: string | null
          exam_type?: string
          id?: string
          max_attempts?: number | null
          pass_mark?: number | null
          question_bank_id?: string | null
          show_result_immediately?: boolean | null
          shuffle_options?: boolean | null
          shuffle_questions?: boolean | null
          start_time?: string | null
          status?: string | null
          subject_id?: string
          term_id?: string
          title?: string
          total_marks?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cbt_exams_class_arm_id_fkey"
            columns: ["class_arm_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbt_exams_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbt_exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cbt_exams_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_arms: {
        Row: {
          capacity: number | null
          class_id: string
          created_at: string
          form_teacher_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          class_id: string
          created_at?: string
          form_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          class_id?: string
          created_at?: string
          form_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_arms_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_arms_form_teacher_id_fkey"
            columns: ["form_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_compulsory: boolean
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_compulsory?: boolean
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_compulsory?: boolean
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: number
          name: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level: number
          name: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount_paid: number
          created_at: string | null
          fee_structure_id: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          paystack_reference: string | null
          receipt_number: string | null
          status: string | null
          student_id: string
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          fee_structure_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          paystack_reference?: string | null
          receipt_number?: string | null
          status?: string | null
          student_id: string
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          fee_structure_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          paystack_reference?: string | null
          receipt_number?: string | null
          status?: string | null
          student_id?: string
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          is_compulsory: boolean | null
          name: string
          session_id: string
          term_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          class_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_compulsory?: boolean | null
          name: string
          session_id: string
          term_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_compulsory?: boolean | null
          name?: string
          session_id?: string
          term_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_scales: {
        Row: {
          created_at: string
          grade: string
          grade_point: number | null
          id: string
          max_score: number
          min_score: number
          remark: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: string
          grade_point?: number | null
          id?: string
          max_score: number
          min_score: number
          remark: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string
          grade_point?: number | null
          id?: string
          max_score?: number
          min_score?: number
          remark?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          performance_alerts: boolean
          result_published: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          performance_alerts?: boolean
          result_published?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          performance_alerts?: boolean
          result_published?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          id: string
          is_active: boolean
          linked_at: string
          linked_by: string | null
          parent_user_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          linked_at?: string
          linked_by?: string | null
          parent_user_id: string
          relationship?: string
          student_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          linked_at?: string
          linked_by?: string | null
          parent_user_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_teacher_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          parent_user_id: string
          replied_at: string | null
          reply: string | null
          student_id: string
          subject: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          parent_user_id: string
          replied_at?: string | null
          reply?: string | null
          student_id: string
          subject: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          parent_user_id?: string
          replied_at?: string | null
          reply?: string | null
          student_id?: string
          subject?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_teacher_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_teacher_messages_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_usage_logs: {
        Row: {
          id: string
          ip_address: string | null
          pin_id: string
          student_id: string | null
          used_at: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          pin_id: string
          student_id?: string | null
          used_at?: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          pin_id?: string
          student_id?: string | null
          used_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pin_usage_logs_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_usage_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pins: {
        Row: {
          created_at: string
          expires_at: string | null
          generated_at: string
          generated_by: string | null
          id: string
          max_usage: number
          pin_code: string
          pin_type: string
          price: number
          serial_number: string
          status: Database["public"]["Enums"]["pin_status"]
          student_id: string | null
          term_id: string | null
          usage_count: number
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          max_usage?: number
          pin_code: string
          pin_type?: string
          price?: number
          serial_number: string
          status?: Database["public"]["Enums"]["pin_status"]
          student_id?: string | null
          term_id?: string | null
          usage_count?: number
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          max_usage?: number
          pin_code?: string
          pin_type?: string
          price?: number
          serial_number?: string
          status?: Database["public"]["Enums"]["pin_status"]
          student_id?: string | null
          term_id?: string | null
          usage_count?: number
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pins_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_banks: {
        Row: {
          class_id: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          subject_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          subject_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          subject_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          explanation: string | null
          id: string
          marks: number | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question_bank_id: string
          question_text: string
          question_type: string
          updated_at: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          marks?: number | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_bank_id: string
          question_text: string
          question_type?: string
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          marks?: number | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_bank_id?: string
          question_text?: string
          question_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      result_components: {
        Row: {
          entered_at: string | null
          entered_by: string | null
          exam_score: number | null
          grade: string | null
          id: string
          other_assessment_score: number | null
          remark: string | null
          result_id: string
          subject_id: string
          subject_position: number | null
          test1_score: number | null
          test2_score: number | null
          total_score: number | null
          updated_at: string
          weighted_score: number | null
        }
        Insert: {
          entered_at?: string | null
          entered_by?: string | null
          exam_score?: number | null
          grade?: string | null
          id?: string
          other_assessment_score?: number | null
          remark?: string | null
          result_id: string
          subject_id: string
          subject_position?: number | null
          test1_score?: number | null
          test2_score?: number | null
          total_score?: number | null
          updated_at?: string
          weighted_score?: number | null
        }
        Update: {
          entered_at?: string | null
          entered_by?: string | null
          exam_score?: number | null
          grade?: string | null
          id?: string
          other_assessment_score?: number | null
          remark?: string | null
          result_id?: string
          subject_id?: string
          subject_position?: number | null
          test1_score?: number | null
          test2_score?: number | null
          total_score?: number | null
          updated_at?: string
          weighted_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "result_components_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_components_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          average_score: number | null
          class_arm_id: string
          class_position: number | null
          class_teacher_id: string | null
          class_teacher_remark: string | null
          created_at: string
          form_teacher_id: string | null
          id: string
          principal_remark: string | null
          published_at: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["result_status"]
          student_id: string
          submitted_at: string | null
          submitted_by: string | null
          term_id: string
          total_score: number | null
          updated_at: string
          verification_code: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          average_score?: number | null
          class_arm_id: string
          class_position?: number | null
          class_teacher_id?: string | null
          class_teacher_remark?: string | null
          created_at?: string
          form_teacher_id?: string | null
          id?: string
          principal_remark?: string | null
          published_at?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["result_status"]
          student_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          term_id: string
          total_score?: number | null
          updated_at?: string
          verification_code?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          average_score?: number | null
          class_arm_id?: string
          class_position?: number | null
          class_teacher_id?: string | null
          class_teacher_remark?: string | null
          created_at?: string
          form_teacher_id?: string | null
          id?: string
          principal_remark?: string | null
          published_at?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["result_status"]
          student_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          term_id?: string
          total_score?: number | null
          updated_at?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "results_class_arm_id_fkey"
            columns: ["class_arm_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_form_teacher_id_fkey"
            columns: ["form_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
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
            foreignKeyName: "results_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      school_admins: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_admins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          motto: string | null
          phone: string | null
          principal_name: string | null
          principal_signature_url: string | null
          school_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          motto?: string | null
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          school_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          motto?: string | null
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          school_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          enabled_features: Json
          id: string
          logo_url: string | null
          max_students: number | null
          max_teachers: number | null
          motto: string | null
          name: string
          phone: string | null
          subscription_ends_at: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          enabled_features?: Json
          id?: string
          logo_url?: string | null
          max_students?: number | null
          max_teachers?: number | null
          motto?: string | null
          name: string
          phone?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          enabled_features?: Json
          id?: string
          logo_url?: string | null
          max_students?: number | null
          max_teachers?: number | null
          motto?: string | null
          name?: string
          phone?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      score_weights: {
        Row: {
          created_at: string
          exam_weight: number
          id: string
          other_assessment_weight: number
          session_id: string
          test1_weight: number
          test2_weight: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_weight?: number
          id?: string
          other_assessment_weight?: number
          session_id: string
          test1_weight?: number
          test2_weight?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_weight?: number
          id?: string
          other_assessment_weight?: number
          session_id?: string
          test1_weight?: number
          test2_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_weights_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string
          admission_number: string
          created_at: string
          current_class_arm_id: string | null
          date_of_birth: string | null
          first_name: string
          gender: string | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_active: boolean
          last_name: string
          middle_name: string | null
          school_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string
          admission_number: string
          created_at?: string
          current_class_arm_id?: string | null
          date_of_birth?: string | null
          first_name: string
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          middle_name?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string
          admission_number?: string
          created_at?: string
          current_class_arm_id?: string | null
          date_of_birth?: string | null
          first_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          middle_name?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_current_class_arm_id_fkey"
            columns: ["current_class_arm_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subjects: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          class_arm_id: string
          id: string
          session_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          class_arm_id: string
          id?: string
          session_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          class_arm_id?: string
          id?: string
          session_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_class_arm_id_fkey"
            columns: ["class_arm_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          date_joined: string
          id: string
          is_active: boolean
          is_class_teacher: boolean | null
          is_form_teacher: boolean | null
          qualification: string | null
          school_id: string | null
          signature_url: string | null
          specialization: string | null
          staff_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_joined?: string
          id?: string
          is_active?: boolean
          is_class_teacher?: boolean | null
          is_form_teacher?: boolean | null
          qualification?: string | null
          school_id?: string | null
          signature_url?: string | null
          specialization?: string | null
          staff_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_joined?: string
          id?: string
          is_active?: boolean
          is_class_teacher?: boolean | null
          is_form_teacher?: boolean | null
          qualification?: string | null
          school_id?: string | null
          signature_url?: string | null
          specialization?: string | null
          staff_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          result_entry_deadline: string | null
          session_id: string
          start_date: string
          term_type: Database["public"]["Enums"]["term_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          result_entry_deadline?: string | null
          session_id: string
          start_date: string
          term_type: Database["public"]["Enums"]["term_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          result_entry_deadline?: string | null
          session_id?: string
          start_date?: string
          term_type?: Database["public"]["Enums"]["term_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      student_performance_analytics: {
        Row: {
          admission_number: string | null
          average_score: number | null
          class_arm_name: string | null
          class_level: number | null
          class_name: string | null
          class_position: number | null
          first_name: string | null
          last_name: string | null
          session_name: string | null
          student_id: string | null
          term_id: string | null
          term_name: string | null
          term_type: Database["public"]["Enums"]["term_type"] | null
          total_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
    }
    Functions: {
      compute_class_positions: {
        Args: { p_class_arm_id: string; p_term_id: string }
        Returns: undefined
      }
      compute_result_aggregates: {
        Args: { p_result_id: string }
        Returns: undefined
      }
      generate_admission_number: { Args: never; Returns: string }
      generate_pin_code: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      generate_verification_code: { Args: never; Returns: string }
      get_grade_for_score: {
        Args: { p_score: number }
        Returns: {
          grade: string
          remark: string
        }[]
      }
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
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "teacher" | "student" | "parent"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "approve"
        | "reject"
        | "publish"
        | "unpublish"
      pin_status: "active" | "used" | "expired" | "deactivated"
      result_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "published"
      term_type: "first" | "second" | "third"
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
      app_role: ["super_admin", "admin", "teacher", "student", "parent"],
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "approve",
        "reject",
        "publish",
        "unpublish",
      ],
      pin_status: ["active", "used", "expired", "deactivated"],
      result_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "published",
      ],
      term_type: ["first", "second", "third"],
    },
  },
} as const
