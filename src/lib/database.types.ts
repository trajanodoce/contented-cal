export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: { id: string; name: string; slug: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string };
        Update: { id?: string; name?: string; slug?: string };
      };
      workspace_members: {
        Row: { workspace_id: string; user_id: string; role: 'admin' | 'editor' | 'viewer'; joined_at: string };
        Insert: { workspace_id: string; user_id: string; role?: 'admin' | 'editor' | 'viewer'; joined_at?: string };
        Update: { role?: 'admin' | 'editor' | 'viewer' };
      };
      content_types: {
        Row: { id: string; workspace_id: string; name: string; icon: string; color: string; default_workflow: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; name: string; icon?: string; color?: string; default_workflow?: Json; created_at?: string };
        Update: { name?: string; icon?: string; color?: string; default_workflow?: Json };
      };
      board_columns: {
        Row: { id: string; workspace_id: string; name: string; position: number; color: string; created_at: string };
        Insert: { id?: string; workspace_id: string; name: string; position?: number; color?: string; created_at?: string };
        Update: { name?: string; position?: number; color?: string };
      };
      projects: {
        Row: { id: string; workspace_id: string; title: string; description: string; owner_id: string | null; start_date: string | null; end_date: string | null; status: string; created_at: string };
        Insert: { id?: string; workspace_id: string; title: string; description?: string; owner_id?: string | null; start_date?: string | null; end_date?: string | null; status?: string };
        Update: { title?: string; description?: string; owner_id?: string | null; start_date?: string | null; end_date?: string | null; status?: string };
      };
      content_items: {
        Row: {
          id: string; workspace_id: string; title: string; content_type_id: string | null;
          status: string | null; assignee_ids: string[]; due_date: string | null; publish_date: string | null;
          channel: string; priority: 'low' | 'medium' | 'high' | 'urgent'; tags: string[];
          description: string; custom_fields: Json; created_by: string | null; project_id: string | null;
          owner_user_id: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; workspace_id: string; title: string; content_type_id?: string | null;
          status?: string | null; assignee_ids?: string[]; due_date?: string | null; publish_date?: string | null;
          channel?: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; tags?: string[];
          description?: string; custom_fields?: Json; created_by?: string | null; project_id?: string | null;
          owner_user_id?: string | null;
        };
        Update: {
          title?: string; content_type_id?: string | null; status?: string | null; assignee_ids?: string[];
          due_date?: string | null; publish_date?: string | null; channel?: string;
          priority?: 'low' | 'medium' | 'high' | 'urgent'; tags?: string[]; description?: string;
          custom_fields?: Json; project_id?: string | null; owner_user_id?: string | null;
        };
      };
      subtasks: {
        Row: { id: string; content_item_id: string; title: string; assignee_id: string | null; due_date: string | null; completed: boolean; position: number; created_at: string };
        Insert: { id?: string; content_item_id: string; title: string; assignee_id?: string | null; due_date?: string | null; completed?: boolean; position?: number };
        Update: { title?: string; assignee_id?: string | null; due_date?: string | null; completed?: boolean; position?: number };
      };
      comments: {
        Row: { id: string; content_item_id: string; user_id: string; body: string; created_at: string };
        Insert: { id?: string; content_item_id: string; user_id: string; body: string };
        Update: { body?: string };
      };
      activity_log: {
        Row: { id: string; content_item_id: string | null; user_id: string | null; action: string; metadata: Json; created_at: string };
        Insert: { id?: string; content_item_id?: string | null; user_id?: string | null; action: string; metadata?: Json };
        Update: never;
      };
      custom_field_definitions: {
        Row: {
          id: string; workspace_id: string; content_type_id: string | null;
          name: string; field_type: CustomFieldType; options: Json;
          required: boolean; position: number; created_at: string;
        };
        Insert: {
          id?: string; workspace_id: string; content_type_id?: string | null;
          name: string; field_type: CustomFieldType; options?: Json;
          required?: boolean; position?: number;
        };
        Update: { name?: string; field_type?: CustomFieldType; options?: Json; required?: boolean; position?: number; content_type_id?: string | null };
      };
      intake_forms: {
        Row: { id: string; workspace_id: string; content_type_id: string | null; name: string; description: string; is_public: boolean; share_slug: string; created_at: string };
        Insert: { id?: string; workspace_id: string; content_type_id?: string | null; name: string; description?: string; is_public?: boolean; share_slug: string };
        Update: { name?: string; description?: string; is_public?: boolean; content_type_id?: string | null };
      };
      intake_form_fields: {
        Row: { id: string; form_id: string; field_key: string; label: string; field_type: string; options: Json; required: boolean; position: number; conditional_on: Json | null; created_at: string };
        Insert: { id?: string; form_id: string; field_key: string; label: string; field_type: string; options?: Json; required?: boolean; position?: number; conditional_on?: Json | null };
        Update: { label?: string; field_type?: string; options?: Json; required?: boolean; position?: number; conditional_on?: Json | null };
      };
      intake_submissions: {
        Row: { id: string; form_id: string; data: Json; submitted_by_email: string | null; created_at: string; converted_to_content_item_id: string | null; status: 'pending' | 'converted' | 'rejected'; reviewed_by: string | null; reviewed_at: string | null };
        Insert: { id?: string; form_id: string; data: Json; submitted_by_email?: string | null };
        Update: { converted_to_content_item_id?: string | null; status?: 'pending' | 'converted' | 'rejected'; reviewed_by?: string | null; reviewed_at?: string | null };
      };
      workspace_invites: {
        Row: { id: string; workspace_id: string; email: string; role: 'admin' | 'editor' | 'viewer'; token: string; invited_by: string | null; created_at: string; accepted_at: string | null };
        Insert: { id?: string; workspace_id: string; email: string; role?: 'admin' | 'editor' | 'viewer'; token?: string; invited_by?: string | null };
        Update: { accepted_at?: string | null; role?: 'admin' | 'editor' | 'viewer' };
      };
      external_links: {
        Row: { id: string; content_item_id: string; platform: ExternalLinkPlatform; url: string; title: string; thumbnail_url: string; metadata: Json; created_by: string | null; created_at: string };
        Insert: { id?: string; content_item_id: string; platform?: ExternalLinkPlatform; url: string; title?: string; thumbnail_url?: string; metadata?: Json; created_by?: string | null };
        Update: { title?: string; thumbnail_url?: string; metadata?: Json };
      };
      integrations: {
        Row: { id: string; workspace_id: string; platform: IntegrationPlatform; access_token: string; refresh_token: string; config: Json; status: 'connected' | 'error' | 'disconnected'; connected_by: string | null; connected_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; platform: IntegrationPlatform; access_token?: string; refresh_token?: string; config?: Json; status?: 'connected' | 'error' | 'disconnected'; connected_by?: string | null };
        Update: { access_token?: string; refresh_token?: string; config?: Json; status?: 'connected' | 'error' | 'disconnected'; updated_at?: string };
      };
      ai_interactions: {
        Row: { id: string; content_item_id: string; workspace_id: string; user_id: string | null; action: AiAction; prompt: string; response: string; created_at: string };
        Insert: { id?: string; content_item_id: string; workspace_id: string; user_id?: string | null; action?: AiAction; prompt?: string; response?: string };
        Update: never;
      };
      ordinal_post_links: {
        Row: {
          id: string;
          content_item_id: string;
          workspace_id: string;
          ordinal_post_id: string;
          platform: 'LinkedIn' | 'X' | 'Instagram' | 'TikTok';
          post_url: string;
          post_body: string;
          status: 'ToDo' | 'Scheduled' | 'Posted';
          scheduled_at: string | null;
          published_at: string | null;
          metrics: Json;
          synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          workspace_id: string;
          ordinal_post_id?: string;
          platform?: 'LinkedIn' | 'X' | 'Instagram' | 'TikTok';
          post_url?: string;
          post_body?: string;
          status?: 'ToDo' | 'Scheduled' | 'Posted';
          scheduled_at?: string | null;
          published_at?: string | null;
          metrics?: Json;
          synced_at?: string;
          created_at?: string;
        };
        Update: {
          ordinal_post_id?: string;
          platform?: 'LinkedIn' | 'X' | 'Instagram' | 'TikTok';
          post_url?: string;
          post_body?: string;
          status?: 'ToDo' | 'Scheduled' | 'Posted';
          scheduled_at?: string | null;
          published_at?: string | null;
          metrics?: Json;
          synced_at?: string;
        };
      };
      ordinal_user_connections: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string;
          profile_id: string;
          profile_name: string;
          platform: 'LinkedIn' | 'X' | 'Instagram' | 'TikTok';
          connected_at: string;
          last_sync_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id: string;
          profile_id: string;
          profile_name?: string;
          platform?: 'LinkedIn' | 'X' | 'Instagram' | 'TikTok';
          connected_at?: string;
          last_sync_at?: string;
        };
        Update: {
          profile_name?: string;
          platform?: 'LinkedIn' | 'X' | 'Instagram' | 'TikTok';
          last_sync_at?: string;
        };
      };
    };
  };
}

export type CustomFieldType = 'text' | 'long_text' | 'number' | 'date' | 'single_select' | 'multi_select' | 'url' | 'checkbox' | 'user';
export type ExternalLinkPlatform = 'ordinal' | 'figma' | 'canva' | 'miro' | 'google_docs' | 'google_drive' | 'notion' | 'linear' | 'other';
export type IntegrationPlatform = 'google' | 'notion' | 'linear' | 'claude' | 'ordinal';
export type AiAction = 'summarize' | 'headlines' | 'meta_description' | 'social_posts' | 'improvements' | 'custom';

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
export type ExternalLink = Database['public']['Tables']['external_links']['Row'];
export type Integration = Database['public']['Tables']['integrations']['Row'];
export type AiInteraction = Database['public']['Tables']['ai_interactions']['Row'];
export type OrdinalPostLink = Database['public']['Tables']['ordinal_post_links']['Row'];
export type OrdinalUserConnection = Database['public']['Tables']['ordinal_user_connections']['Row'];

export interface SelectOption { value: string; label: string }

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}
