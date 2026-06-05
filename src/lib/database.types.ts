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
      activity_log: {
        Row: {
          action: string
          content_item_id: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          content_item_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          content_item_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interactions: {
        Row: {
          action: string
          content_item_id: string
          created_at: string
          id: string
          prompt: string | null
          response: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          content_item_id: string
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          content_item_id?: string
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_columns: {
        Row: {
          color: string | null
          id: string
          name: string
          position: number
          workspace_id: string
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
          position?: number
          workspace_id: string
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          position?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          content_item_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          mentions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          content_item_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          mentions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          content_item_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          mentions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          archived: boolean
          assignee_ids: string[] | null
          category: Database["public"]["Enums"]["task_category"]
          channel: string | null
          completed: boolean
          completed_at: string | null
          content_type_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          fts: unknown
          id: string
          needs_triage: boolean
          priority: Database["public"]["Enums"]["priority_level"] | null
          project_id: string | null
          publish_date: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          assignee_ids?: string[] | null
          category?: Database["public"]["Enums"]["task_category"]
          channel?: string | null
          completed?: boolean
          completed_at?: string | null
          content_type_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          fts?: unknown
          id?: string
          needs_triage?: boolean
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_id?: string | null
          publish_date?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          assignee_ids?: string[] | null
          category?: Database["public"]["Enums"]["task_category"]
          channel?: string | null
          completed?: boolean
          completed_at?: string | null
          content_type_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          fts?: unknown
          id?: string
          needs_triage?: boolean
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_id?: string | null
          publish_date?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_created_by_profiles_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          color: string | null
          created_at: string
          default_workflow: Json | null
          icon: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_workflow?: Json | null
          icon?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          default_workflow?: Json | null
          icon?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          applies_to: Database["public"]["Enums"]["field_applies_to"]
          content_type_id: string | null
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          name: string
          options: Json | null
          position: number
          required: boolean
          workspace_id: string
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["field_applies_to"]
          content_type_id?: string | null
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          name: string
          options?: Json | null
          position?: number
          required?: boolean
          workspace_id: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["field_applies_to"]
          content_type_id?: string | null
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          name?: string
          options?: Json | null
          position?: number
          required?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_links: {
        Row: {
          content_item_id: string
          created_at: string
          id: string
          metadata: Json | null
          platform: Database["public"]["Enums"]["platform_type"]
          thumbnail_url: string | null
          title: string | null
          url: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          platform?: Database["public"]["Enums"]["platform_type"]
          thumbnail_url?: string | null
          title?: string | null
          url: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          platform?: Database["public"]["Enums"]["platform_type"]
          thumbnail_url?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_links_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      granola_note_links: {
        Row: {
          attendees: Json | null
          content_item_id: string
          created_at: string | null
          granola_folder: string | null
          granola_note_id: string
          id: string
          meeting_end: string | null
          meeting_start: string | null
          note_title: string | null
          owner_id: string
          summary_markdown: string | null
          summary_text: string | null
          synced_at: string | null
          web_url: string | null
        }
        Insert: {
          attendees?: Json | null
          content_item_id: string
          created_at?: string | null
          granola_folder?: string | null
          granola_note_id: string
          id?: string
          meeting_end?: string | null
          meeting_start?: string | null
          note_title?: string | null
          owner_id: string
          summary_markdown?: string | null
          summary_text?: string | null
          synced_at?: string | null
          web_url?: string | null
        }
        Update: {
          attendees?: Json | null
          content_item_id?: string
          created_at?: string | null
          granola_folder?: string | null
          granola_note_id?: string
          id?: string
          meeting_end?: string | null
          meeting_start?: string | null
          note_title?: string | null
          owner_id?: string
          summary_markdown?: string | null
          summary_text?: string | null
          synced_at?: string | null
          web_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "granola_note_links_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "granola_note_links_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_form_fields: {
        Row: {
          conditional_on: Json | null
          field_key: string
          field_type: string
          form_id: string
          id: string
          label: string
          options: Json | null
          position: number
          required: boolean
        }
        Insert: {
          conditional_on?: Json | null
          field_key: string
          field_type: string
          form_id: string
          id?: string
          label: string
          options?: Json | null
          position?: number
          required?: boolean
        }
        Update: {
          conditional_on?: Json | null
          field_key?: string
          field_type?: string
          form_id?: string
          id?: string
          label?: string
          options?: Json | null
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "intake_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          content_type_id: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          share_slug: string | null
          workspace_id: string
        }
        Insert: {
          content_type_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          share_slug?: string | null
          workspace_id: string
        }
        Update: {
          content_type_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          share_slug?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_submissions: {
        Row: {
          converted_to_content_item_id: string | null
          created_at: string
          data: Json
          form_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by_email: string | null
        }
        Insert: {
          converted_to_content_item_id?: string | null
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by_email?: string | null
        }
        Update: {
          converted_to_content_item_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_converted_to_content_item_id_fkey"
            columns: ["converted_to_content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "intake_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          config: Json | null
          connected_at: string
          connected_by: string | null
          id: string
          platform: string
          refresh_token: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          config?: Json | null
          connected_at?: string
          connected_by?: string | null
          id?: string
          platform: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          config?: Json | null
          connected_at?: string
          connected_by?: string | null
          id?: string
          platform?: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_connected_by_profiles_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_issue_links: {
        Row: {
          assignee_name: string | null
          content_item_id: string
          id: string
          linear_issue_id: string
          linear_team_id: string | null
          linear_team_name: string | null
          priority_label: string | null
          status: string | null
          synced_at: string
          title: string | null
          url: string | null
        }
        Insert: {
          assignee_name?: string | null
          content_item_id: string
          id?: string
          linear_issue_id: string
          linear_team_id?: string | null
          linear_team_name?: string | null
          priority_label?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          url?: string | null
        }
        Update: {
          assignee_name?: string | null
          content_item_id?: string
          id?: string
          linear_issue_id?: string
          linear_team_id?: string | null
          linear_team_name?: string | null
          priority_label?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linear_issue_links_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notion_page_links: {
        Row: {
          content_item_id: string
          id: string
          last_synced_at: string
          notion_database_id: string | null
          notion_page_id: string
          notion_page_url: string | null
          status: string | null
          sync_direction: string
          title: string | null
        }
        Insert: {
          content_item_id: string
          id?: string
          last_synced_at?: string
          notion_database_id?: string | null
          notion_page_id: string
          notion_page_url?: string | null
          status?: string | null
          sync_direction?: string
          title?: string | null
        }
        Update: {
          content_item_id?: string
          id?: string
          last_synced_at?: string
          notion_database_id?: string | null
          notion_page_id?: string
          notion_page_url?: string | null
          status?: string | null
          sync_direction?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notion_page_links_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ordinal_post_links: {
        Row: {
          content_item_id: string
          id: string
          metrics: Json | null
          ordinal_post_id: string
          platform: string | null
          post_body: string | null
          post_url: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string | null
          synced_at: string
        }
        Insert: {
          content_item_id: string
          id?: string
          metrics?: Json | null
          ordinal_post_id: string
          platform?: string | null
          post_body?: string | null
          post_url?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          synced_at?: string
        }
        Update: {
          content_item_id?: string
          id?: string
          metrics?: Json | null
          ordinal_post_id?: string
          platform?: string | null
          post_body?: string | null
          post_url?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordinal_post_links_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ordinal_user_connections: {
        Row: {
          connected_at: string
          id: string
          last_sync_at: string
          platform: string | null
          profile_id: string
          profile_name: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          last_sync_at?: string
          platform?: string | null
          profile_id: string
          profile_name?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          last_sync_at?: string
          platform?: string | null
          profile_id?: string
          profile_name?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordinal_user_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_profiles_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          assignee_id: string | null
          completed: boolean
          content_item_id: string
          due_date: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          assignee_id?: string | null
          completed?: boolean
          content_item_id: string
          due_date?: string | null
          id?: string
          position?: number
          title: string
        }
        Update: {
          assignee_id?: string | null
          completed?: boolean
          content_item_id?: string
          due_date?: string | null
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_assignee_id_profiles_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_field_mappings: {
        Row: {
          calendar_field: string
          created_at: string
          external_field: string
          id: string
          platform: string
          value_mappings: Json | null
          workspace_id: string
        }
        Insert: {
          calendar_field: string
          created_at?: string
          external_field: string
          id?: string
          platform: string
          value_mappings?: Json | null
          workspace_id: string
        }
        Update: {
          calendar_field?: string
          created_at?: string
          external_field?: string
          id?: string
          platform?: string
          value_mappings?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_field_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          created_at: string
          direction: string
          error_message: string | null
          id: string
          items_synced: number | null
          metadata: Json | null
          platform: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          items_synced?: number | null
          metadata?: Json | null
          platform: string
          status: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          items_synced?: number | null
          metadata?: Json | null
          platform?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_schedule: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_sync_result: Json | null
          last_synced_at: string | null
          next_sync_at: string | null
          platform: string
          sync_interval_minutes: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_result?: Json | null
          last_synced_at?: string | null
          next_sync_at?: string | null
          platform: string
          sync_interval_minutes?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_result?: Json | null
          last_synced_at?: string | null
          next_sync_at?: string | null
          platform?: string
          sync_interval_minutes?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_schedule_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_alerts: {
        Row: {
          actor_id: string | null
          alert_type: string
          content_item_id: string | null
          created_at: string
          id: string
          read_at: string | null
          source_id: string
          source_type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          alert_type: string
          content_item_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          source_id: string
          source_type: string
          user_id: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          alert_type?: string
          content_item_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          source_id?: string
          source_type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alerts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string | null
          config: Json | null
          connected_at: string | null
          id: string
          platform: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          config?: Json | null
          connected_at?: string | null
          id?: string
          platform: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          config?: Json | null
          connected_at?: string | null
          id?: string
          platform?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          muted_projects: string[]
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          muted_projects?: string[]
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          muted_projects?: string[]
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_mark_sync_due: {
        Args: { p_platform: string; p_workspace_id: string }
        Returns: boolean
      }
      duplicate_content_item: { Args: { item_id: string }; Returns: string }
      get_ordinal_sync_status: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      get_workspace_role: {
        Args: { ws_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      get_workspace_stats: { Args: { ws_id: string }; Returns: Json }
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean }
      record_sync_result: {
        Args: { p_platform: string; p_result: Json; p_workspace_id: string }
        Returns: undefined
      }
      search_content_items: {
        Args: { search_query: string; ws_id: string }
        Returns: {
          assignee_ids: string[] | null
          channel: string | null
          content_type_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          fts: unknown
          id: string
          priority: Database["public"]["Enums"]["priority_level"] | null
          project_id: string | null
          publish_date: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "content_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      upsert_granola_note:
        | {
            Args: {
              p_attendees?: Json
              p_folder_name?: string
              p_granola_note_id: string
              p_meeting_end?: string
              p_meeting_start?: string
              p_summary_markdown?: string
              p_summary_text?: string
              p_title: string
              p_web_url?: string
              p_workspace_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_attendees?: Json
              p_folder_name?: string
              p_granola_note_id: string
              p_meeting_end?: string
              p_meeting_start?: string
              p_owner_id?: string
              p_summary_markdown?: string
              p_summary_text?: string
              p_title: string
              p_web_url?: string
              p_workspace_id: string
            }
            Returns: string
          }
      upsert_ordinal_post: {
        Args: {
          p_channel: string
          p_labels?: string[]
          p_ordinal_assets?: Json
          p_ordinal_post_id: string
          p_post_body?: string
          p_post_url?: string
          p_profile_handle?: string
          p_profile_name?: string
          p_publish_at?: string
          p_status: string
          p_title: string
          p_workspace_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      field_applies_to: "content" | "design" | "both"
      field_type:
        | "text"
        | "long_text"
        | "number"
        | "date"
        | "single_select"
        | "multi_select"
        | "url"
        | "checkbox"
        | "user"
      platform_type:
        | "ordinal"
        | "figma"
        | "canva"
        | "miro"
        | "google_docs"
        | "google_drive"
        | "notion"
        | "linear"
        | "other"
        | "granola"
        | "file"
      priority_level: "low" | "medium" | "high" | "urgent"
      project_status: "active" | "completed" | "archived"
      task_category: "content" | "design"
      workspace_role: "admin" | "editor" | "viewer"
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
      field_applies_to: ["content", "design", "both"],
      field_type: [
        "text",
        "long_text",
        "number",
        "date",
        "single_select",
        "multi_select",
        "url",
        "checkbox",
        "user",
      ],
      platform_type: [
        "ordinal",
        "figma",
        "canva",
        "miro",
        "google_docs",
        "google_drive",
        "notion",
        "linear",
        "other",
        "granola",
        "file",
      ],
      priority_level: ["low", "medium", "high", "urgent"],
      project_status: ["active", "completed", "archived"],
      task_category: ["content", "design"],
      workspace_role: ["admin", "editor", "viewer"],
    },
  },
} as const

// ── Convenience type aliases (used throughout the app) ──────────────────────

export type Workspace = Database['public']['Tables']['workspaces']['Row'];
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];
export type ContentType = Database['public']['Tables']['content_types']['Row'];
export type BoardColumn = Database['public']['Tables']['board_columns']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ContentItem = Database['public']['Tables']['content_items']['Row'];
export type Subtask = Database['public']['Tables']['subtasks']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_log']['Row'];
export type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];
export type IntakeForm = Database['public']['Tables']['intake_forms']['Row'];
export type IntakeFormField = Database['public']['Tables']['intake_form_fields']['Row'];
export type IntakeSubmission = Database['public']['Tables']['intake_submissions']['Row'];
export type WorkspaceInvite = Database['public']['Tables']['workspace_invites']['Row'];
export type OrdinalUserConnection = Database['public']['Tables']['ordinal_user_connections']['Row'];
export type ExternalLink = Database['public']['Tables']['external_links']['Row'];
export type Integration = Database['public']['Tables']['integrations']['Row'];
export type AiInteraction = Database['public']['Tables']['ai_interactions']['Row'];
export type OrdinalPostLink = Database['public']['Tables']['ordinal_post_links']['Row'];
export type GranolaNoteLink = Database['public']['Tables']['granola_note_links']['Row'];
export type UserIntegration = Database['public']['Tables']['user_integrations']['Row'];
export type UserAlert = Database['public']['Tables']['user_alerts']['Row'];

// Personal tasks (manually typed until next type generation)
export interface PersonalTask {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  notes: string | null;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Enum type aliases for backward compatibility
export type CustomFieldType = Database['public']['Enums']['field_type'];
export type ExternalLinkPlatform = Database['public']['Enums']['platform_type'];
export type TaskCategory = Database['public']['Enums']['task_category'];
export type FieldAppliesTo = Database['public']['Enums']['field_applies_to'];
export type WorkspaceRole = Database['public']['Enums']['workspace_role'];
export type IntegrationPlatform = 'google' | 'notion' | 'linear' | 'claude' | 'ordinal' | 'granola' | 'slack';
export type AiAction = 'quick_draft' | 'full_workflow' | 'headlines' | 'social_posts' | 'schwartz_diagnosis' | 'stop_slop_audit' | 'improvements' | 'meta_description' | 'custom';

export interface SelectOption { value: string; label: string; color?: string }

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}
