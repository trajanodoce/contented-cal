-- Performance: add covering indexes for workspace_id foreign keys on
-- tables that are queried per-workspace on the hot paths. Without these,
-- every workspace-scoped SELECT (and any future cascading delete from
-- workspaces) does a sequential scan.
--
-- Scope: only the 4 workspace_id FKs whose tables are read on common
-- views. The other unindexed FKs flagged by the advisor (user_id /
-- owner_id / content_type_id / converted_to_content_item_id) are on
-- less-trafficked code paths and stay deferred until they actually
-- show up in slow queries.
--
-- Advisor: unindexed_foreign_keys (4 of 17 highest-impact).

CREATE INDEX IF NOT EXISTS idx_personal_tasks_workspace_id
  ON public.personal_tasks (workspace_id);

CREATE INDEX IF NOT EXISTS idx_project_library_workspace_id
  ON public.project_library (workspace_id);

CREATE INDEX IF NOT EXISTS idx_sync_schedule_workspace_id
  ON public.sync_schedule (workspace_id);

CREATE INDEX IF NOT EXISTS idx_ordinal_user_connections_workspace_id
  ON public.ordinal_user_connections (workspace_id);
