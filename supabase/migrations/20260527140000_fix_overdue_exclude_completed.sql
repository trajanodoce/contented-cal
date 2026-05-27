-- Fix overdue_items count to exclude both Published and Completed statuses
CREATE OR REPLACE FUNCTION public.get_workspace_stats(ws_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
result json;
BEGIN
SELECT json_build_object(
'total_items', (SELECT count(*) FROM public.content_items WHERE workspace_id = ws_id),
'overdue_items', (
  SELECT count(*) FROM public.content_items ci
  WHERE ci.workspace_id = ws_id
    AND ci.due_date < CURRENT_DATE
    AND ci.status NOT IN (
      SELECT id FROM public.board_columns
      WHERE workspace_id = ws_id AND (name = 'Published' OR name = 'Completed')
    )
),
'items_by_status', (
  SELECT json_agg(json_build_object('status_id', bc.id, 'status_name', bc.name, 'color', bc.color, 'count', coalesce(ci.cnt, 0)))
  FROM public.board_columns bc
  LEFT JOIN (SELECT status, count(*) as cnt FROM public.content_items WHERE workspace_id = ws_id GROUP BY status) ci ON ci.status = bc.id
  WHERE bc.workspace_id = ws_id
  ORDER BY bc.position
),
'items_by_type', (
  SELECT json_agg(json_build_object('type_id', ct.id, 'type_name', ct.name, 'color', ct.color, 'count', coalesce(ci.cnt, 0)))
  FROM public.content_types ct
  LEFT JOIN (SELECT content_type_id, count(*) as cnt FROM public.content_items WHERE workspace_id = ws_id GROUP BY content_type_id) ci ON ci.content_type_id = ct.id
  WHERE ct.workspace_id = ws_id
),
'items_by_priority', (
  SELECT json_agg(json_build_object('priority', p.priority, 'count', coalesce(ci.cnt, 0)))
  FROM (VALUES ('low'::public.priority_level), ('medium'), ('high'), ('urgent')) AS p(priority)
  LEFT JOIN (SELECT priority, count(*) as cnt FROM public.content_items WHERE workspace_id = ws_id GROUP BY priority) ci ON ci.priority = p.priority
),
'upcoming_due', (
  SELECT json_agg(json_build_object('id', id, 'title', title, 'due_date', due_date, 'priority', priority) ORDER BY due_date)
  FROM (SELECT id, title, due_date, priority FROM public.content_items WHERE workspace_id = ws_id AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + interval '7 days' ORDER BY due_date LIMIT 10) sub
),
'recent_activity', (
  SELECT json_agg(json_build_object('id', al.id, 'action', al.action, 'user_name', p.full_name, 'created_at', al.created_at) ORDER BY al.created_at DESC)
  FROM (SELECT * FROM public.activity_log WHERE content_item_id IN (SELECT id FROM public.content_items WHERE workspace_id = ws_id) ORDER BY created_at DESC LIMIT 15) al
  LEFT JOIN public.profiles p ON p.id = al.user_id
)
) INTO result;
RETURN result;
END;
$$;
