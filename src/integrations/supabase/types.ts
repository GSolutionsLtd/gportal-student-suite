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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          school_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          school_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          school_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_reminders: {
        Row: {
          assignment_id: string
          id: string
          reminder_window: string
          sent_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          id?: string
          reminder_window: string
          sent_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          id?: string
          reminder_window?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_reminders_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_rubric_criteria: {
        Row: {
          assignment_id: string
          created_at: string
          description: string | null
          id: string
          max_score: number
          school_id: string
          sort_order: number
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          assignment_id: string
          created_at?: string
          description?: string | null
          id?: string
          max_score?: number
          school_id: string
          sort_order?: number
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          assignment_id?: string
          created_at?: string
          description?: string | null
          id?: string
          max_score?: number
          school_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      assignment_rubric_scores: {
        Row: {
          assignment_id: string
          created_at: string
          criterion_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          school_id: string
          score: number
          student_id: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          criterion_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id: string
          score?: number
          student_id: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          criterion_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string
          score?: number
          student_id?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignment_submission_revisions: {
        Row: {
          assignment_id: string
          attachment_url: string | null
          created_at: string
          id: string
          response_text: string | null
          revision_number: number
          school_id: string
          student_id: string
          submission_id: string
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          attachment_url?: string | null
          created_at?: string
          id?: string
          response_text?: string | null
          revision_number: number
          school_id: string
          student_id: string
          submission_id: string
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          attachment_url?: string | null
          created_at?: string
          id?: string
          response_text?: string | null
          revision_number?: number
          school_id?: string
          student_id?: string
          submission_id?: string
          submitted_at?: string | null
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attachment_url: string | null
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          response_text: string | null
          resubmission_count: number
          revision_number: number
          school_id: string
          score: number | null
          score_released: boolean
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          attachment_url?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          response_text?: string | null
          resubmission_count?: number
          revision_number?: number
          school_id: string
          score?: number | null
          score_released?: boolean
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          attachment_url?: string | null
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          response_text?: string | null
          resubmission_count?: number
          revision_number?: number
          school_id?: string
          score?: number | null
          score_released?: boolean
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          allow_resubmissions: boolean
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          class_arm_id: string
          created_at: string
          created_by: string
          due_at: string | null
          due_notification_sent_at: string | null
          id: string
          instructions: string | null
          max_score: number
          published_notified_at: string | null
          school_id: string
          scores_approved: boolean
          session_id: string | null
          status: string
          subject_id: string
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_resubmissions?: boolean
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          class_arm_id: string
          created_at?: string
          created_by: string
          due_at?: string | null
          due_notification_sent_at?: string | null
          id?: string
          instructions?: string | null
          max_score?: number
          published_notified_at?: string | null
          school_id: string
          scores_approved?: boolean
          session_id?: string | null
          status?: string
          subject_id: string
          teacher_id: string
          term_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_resubmissions?: boolean
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          class_arm_id?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          due_notification_sent_at?: string | null
          id?: string
          instructions?: string | null
          max_score?: number
          published_notified_at?: string | null
          school_id?: string
          scores_approved?: boolean
          session_id?: string | null
          status?: string
          subject_id?: string
          teacher_id?: string
          term_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attendance_date: string
          class_arm_id: string
          created_at: string
          id: string
          recorded_by: string | null
          remark: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          class_arm_id: string
          created_at?: string
          id?: string
          recorded_by?: string | null
          remark?: string | null
          school_id: string
          status: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          class_arm_id?: string
          created_at?: string
          id?: string
          recorded_by?: string | null
          remark?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_arm_id_fkey"
            columns: ["class_arm_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_assessments: {
        Row: {
          artistic: number
          conventional: number
          created_at: string
          dominant_type: string | null
          enterprising: number
          holland_code: string | null
          id: string
          investigative: number
          raw_answers: Json | null
          realistic: number
          school_id: string | null
          social: number
          student_id: string | null
          subscriber_user_id: string | null
        }
        Insert: {
          artistic?: number
          conventional?: number
          created_at?: string
          dominant_type?: string | null
          enterprising?: number
          holland_code?: string | null
          id?: string
          investigative?: number
          raw_answers?: Json | null
          realistic?: number
          school_id?: string | null
          social?: number
          student_id?: string | null
          subscriber_user_id?: string | null
        }
        Update: {
          artistic?: number
          conventional?: number
          created_at?: string
          dominant_type?: string | null
          enterprising?: number
          holland_code?: string | null
          id?: string
          investigative?: number
          raw_answers?: Json | null
          realistic?: number
          school_id?: string | null
          social?: number
          student_id?: string | null
          subscriber_user_id?: string | null
        }
        Relationships: []
      }
      career_counseling_sessions: {
        Row: {
          completed_at: string | null
          counselor_user_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          meeting_url: string | null
          notes: string | null
          requested_by: string | null
          scheduled_at: string
          school_id: string | null
          status: string
          student_id: string | null
          subscriber_user_id: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          counselor_user_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          notes?: string | null
          requested_by?: string | null
          scheduled_at: string
          school_id?: string | null
          status?: string
          student_id?: string | null
          subscriber_user_id?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          counselor_user_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          notes?: string | null
          requested_by?: string | null
          scheduled_at?: string
          school_id?: string | null
          status?: string
          student_id?: string | null
          subscriber_user_id?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      career_mock_interviews: {
        Row: {
          answers: Json | null
          career_path: string
          completed_at: string | null
          created_at: string
          feedback: string | null
          id: string
          questions: Json
          school_id: string | null
          score: number | null
          status: string
          student_id: string | null
          subscriber_user_id: string | null
        }
        Insert: {
          answers?: Json | null
          career_path: string
          completed_at?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          questions?: Json
          school_id?: string | null
          score?: number | null
          status?: string
          student_id?: string | null
          subscriber_user_id?: string | null
        }
        Update: {
          answers?: Json | null
          career_path?: string
          completed_at?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          questions?: Json
          school_id?: string | null
          score?: number | null
          status?: string
          student_id?: string | null
          subscriber_user_id?: string | null
        }
        Relationships: []
      }
      career_plan_goals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          progress: number
          school_id: string | null
          status: string
          student_id: string | null
          subscriber_user_id: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          school_id?: string | null
          status?: string
          student_id?: string | null
          subscriber_user_id?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          school_id?: string | null
          status?: string
          student_id?: string | null
          subscriber_user_id?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_plan_goals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_plan_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      career_recommendation_paths: {
        Row: {
          career_title: string
          colleges_of_education: string[] | null
          created_at: string
          id: string
          jamb_cutoff: string | null
          jamb_subjects: string[] | null
          market_relevance: string | null
          polytechnics: string[] | null
          rank: number
          recommendation_id: string
          salary_insight: string | null
          school_id: string | null
          soft_skills: string[] | null
          ss_subjects: string[] | null
          student_id: string | null
          subscriber_user_id: string | null
          tech_skills: string[] | null
          universities: string[] | null
          university_courses: string[] | null
        }
        Insert: {
          career_title: string
          colleges_of_education?: string[] | null
          created_at?: string
          id?: string
          jamb_cutoff?: string | null
          jamb_subjects?: string[] | null
          market_relevance?: string | null
          polytechnics?: string[] | null
          rank: number
          recommendation_id: string
          salary_insight?: string | null
          school_id?: string | null
          soft_skills?: string[] | null
          ss_subjects?: string[] | null
          student_id?: string | null
          subscriber_user_id?: string | null
          tech_skills?: string[] | null
          universities?: string[] | null
          university_courses?: string[] | null
        }
        Update: {
          career_title?: string
          colleges_of_education?: string[] | null
          created_at?: string
          id?: string
          jamb_cutoff?: string | null
          jamb_subjects?: string[] | null
          market_relevance?: string | null
          polytechnics?: string[] | null
          rank?: number
          recommendation_id?: string
          salary_insight?: string | null
          school_id?: string | null
          soft_skills?: string[] | null
          ss_subjects?: string[] | null
          student_id?: string | null
          subscriber_user_id?: string | null
          tech_skills?: string[] | null
          universities?: string[] | null
          university_courses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "career_recommendation_paths_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "career_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      career_recommendations: {
        Row: {
          assessment_id: string | null
          created_at: string
          id: string
          model: string | null
          school_id: string | null
          student_id: string | null
          subscriber_user_id: string | null
          summary: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          school_id?: string | null
          student_id?: string | null
          subscriber_user_id?: string | null
          summary?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          model?: string | null
          school_id?: string | null
          student_id?: string | null
          subscriber_user_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_recommendations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "career_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      career_resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          posted_by: string | null
          school_id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          posted_by?: string | null
          school_id: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          posted_by?: string | null
          school_id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      careeraid_subscriptions: {
        Row: {
          amount: number
          class_level: string | null
          created_at: string
          email: string
          expires_at: string | null
          full_name: string
          id: string
          paystack_reference: string | null
          phone: string | null
          school_id: string | null
          starts_at: string | null
          state_of_residence: string | null
          status: string
          student_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          class_level?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          full_name: string
          id?: string
          paystack_reference?: string | null
          phone?: string | null
          school_id?: string | null
          starts_at?: string | null
          state_of_residence?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          class_level?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          full_name?: string
          id?: string
          paystack_reference?: string | null
          phone?: string | null
          school_id?: string | null
          starts_at?: string | null
          state_of_residence?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "careeraid_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "careeraid_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "cbt_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "cbt_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
          {
            foreignKeyName: "class_arms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      contact_submissions: {
        Row: {
          city_state: string
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string
          school_name: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city_state: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone: string
          school_name: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city_state?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string
          school_name?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      counselor_payouts: {
        Row: {
          amount: number
          counselor_user_id: string
          id: string
          notes: string | null
          paid_at: string | null
          period_month: string
          requested_at: string
          status: string
          students_counseled: number
        }
        Insert: {
          amount?: number
          counselor_user_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month: string
          requested_at?: string
          status?: string
          students_counseled?: number
        }
        Update: {
          amount?: number
          counselor_user_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month?: string
          requested_at?: string
          status?: string
          students_counseled?: number
        }
        Relationships: []
      }
      counselor_wallet_entries: {
        Row: {
          amount: number
          counselor_user_id: string
          created_at: string
          id: string
          payout_id: string | null
          period_month: string
          session_id: string | null
          subject_key: string
          subject_label: string | null
        }
        Insert: {
          amount?: number
          counselor_user_id: string
          created_at?: string
          id?: string
          payout_id?: string | null
          period_month: string
          session_id?: string | null
          subject_key: string
          subject_label?: string | null
        }
        Update: {
          amount?: number
          counselor_user_id?: string
          created_at?: string
          id?: string
          payout_id?: string | null
          period_month?: string
          session_id?: string | null
          subject_key?: string
          subject_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counselor_wallet_entries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "counselor_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselor_wallet_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "career_counseling_sessions"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_versions: {
        Row: {
          activities: string | null
          change_kind: string
          changed_by: string | null
          class_arm_id: string | null
          created_at: string
          duration_minutes: number | null
          evaluation: string | null
          grade_level: string | null
          homework: string | null
          id: string
          introduction: string | null
          lesson_plan_id: string
          main_content: string | null
          materials: string | null
          objectives: string | null
          references_notes: string | null
          school_id: string
          status: string | null
          subject_id: string | null
          title: string | null
          topic: string | null
          version_number: number
        }
        Insert: {
          activities?: string | null
          change_kind?: string
          changed_by?: string | null
          class_arm_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          evaluation?: string | null
          grade_level?: string | null
          homework?: string | null
          id?: string
          introduction?: string | null
          lesson_plan_id: string
          main_content?: string | null
          materials?: string | null
          objectives?: string | null
          references_notes?: string | null
          school_id: string
          status?: string | null
          subject_id?: string | null
          title?: string | null
          topic?: string | null
          version_number: number
        }
        Update: {
          activities?: string | null
          change_kind?: string
          changed_by?: string | null
          class_arm_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          evaluation?: string | null
          grade_level?: string | null
          homework?: string | null
          id?: string
          introduction?: string | null
          lesson_plan_id?: string
          main_content?: string | null
          materials?: string | null
          objectives?: string | null
          references_notes?: string | null
          school_id?: string
          status?: string | null
          subject_id?: string | null
          title?: string | null
          topic?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plan_versions_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          activities: string | null
          ai_generated: boolean
          class_arm_id: string | null
          created_at: string
          duration_minutes: number | null
          evaluation: string | null
          grade_level: string | null
          homework: string | null
          id: string
          introduction: string | null
          main_content: string | null
          materials: string | null
          objectives: string | null
          references_notes: string | null
          school_id: string
          status: string
          subject_id: string | null
          teacher_user_id: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          activities?: string | null
          ai_generated?: boolean
          class_arm_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          evaluation?: string | null
          grade_level?: string | null
          homework?: string | null
          id?: string
          introduction?: string | null
          main_content?: string | null
          materials?: string | null
          objectives?: string | null
          references_notes?: string | null
          school_id: string
          status?: string
          subject_id?: string | null
          teacher_user_id: string
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          activities?: string | null
          ai_generated?: boolean
          class_arm_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          evaluation?: string | null
          grade_level?: string | null
          homework?: string | null
          id?: string
          introduction?: string | null
          main_content?: string | null
          materials?: string | null
          objectives?: string | null
          references_notes?: string | null
          school_id?: string
          status?: string
          subject_id?: string | null
          teacher_user_id?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_class_arm_id_fkey"
            columns: ["class_arm_id"]
            isOneToOne: false
            referencedRelation: "class_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          performance_alerts: boolean
          result_published: boolean
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_school_memberships: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          linked_by: string | null
          parent_user_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          linked_by?: string | null
          parent_user_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          linked_by?: string | null
          parent_user_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          id: string
          is_active: boolean
          linked_at: string
          linked_by: string | null
          parent_user_id: string
          relationship: string
          school_id: string | null
          student_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          linked_at?: string
          linked_by?: string | null
          parent_user_id: string
          relationship?: string
          school_id?: string | null
          student_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          linked_at?: string
          linked_by?: string | null
          parent_user_id?: string
          relationship?: string
          school_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          student_id?: string
          subject?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_teacher_messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["pin_status"]
          student_id?: string | null
          term_id?: string | null
          usage_count?: number
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
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
      product_tour_clicks: {
        Row: {
          created_at: string
          id: string
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "question_banks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "result_components_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            foreignKeyName: "results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          school_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_website_sections: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_published: boolean
          link_url: string | null
          school_id: string
          section_type: string
          slug: string | null
          sort_order: number
          title: string
          updated_at: string
          website_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          link_url?: string | null
          school_id: string
          section_type?: string
          slug?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          website_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          link_url?: string | null
          school_id?: string
          section_type?: string
          slug?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_website_sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_website_sections_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "school_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      school_websites: {
        Row: {
          about: string | null
          address: string | null
          admissions_info: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          hero_image_url: string | null
          id: string
          is_published: boolean
          school_id: string
          social_links: Json
          tagline: string | null
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          address?: string | null
          admissions_info?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          school_id: string
          social_links?: Json
          tagline?: string | null
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          address?: string | null
          admissions_info?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          school_id?: string
          social_links?: Json
          tagline?: string | null
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_websites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      student_career_profiles: {
        Row: {
          created_at: string
          goals: string | null
          id: string
          interests: string[]
          school_id: string
          strengths: string[]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          goals?: string | null
          id?: string
          interests?: string[]
          school_id: string
          strengths?: string[]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          goals?: string | null
          id?: string
          interests?: string[]
          school_id?: string
          strengths?: string[]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_saves: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_saves_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "career_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_saves_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          school_id: string | null
          session_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          class_arm_id: string
          id?: string
          school_id?: string | null
          session_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          class_arm_id?: string
          id?: string
          school_id?: string | null
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
            foreignKeyName: "teacher_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
          session_id?: string
          start_date?: string
          term_type?: Database["public"]["Enums"]["term_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
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
      can_claim_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      compute_class_positions: {
        Args: { p_class_arm_id: string; p_term_id: string }
        Returns: undefined
      }
      compute_result_aggregates: {
        Args: { p_result_id: string }
        Returns: undefined
      }
      generate_admin_invite_code: { Args: never; Returns: string }
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
      get_teacher_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_school_code: { Args: { _user_id: string }; Returns: string }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_school_access: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      list_signup_schools: {
        Args: never
        Returns: {
          admin_available: boolean
          code: string
          id: string
          name: string
        }[]
      }
      notify_due_assignments: { Args: never; Returns: number }
      request_counselor_payout: {
        Args: never
        Returns: {
          amount: number
          counselor_user_id: string
          id: string
          notes: string | null
          paid_at: string | null
          period_month: string
          requested_at: string
          status: string
          students_counseled: number
        }
        SetofOptions: {
          from: "*"
          to: "counselor_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_admin_invite: {
        Args: { _code: string }
        Returns: {
          email: string
          school_code: string
          school_id: string
          school_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "teacher"
        | "student"
        | "parent"
        | "counselor"
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
        | "upload"
        | "download"
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
      app_role: [
        "super_admin",
        "admin",
        "teacher",
        "student",
        "parent",
        "counselor",
      ],
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
        "upload",
        "download",
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
