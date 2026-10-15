-- Atomic professor direct-complete (P0-5)
-- Deletes any prior NULL-member completion, inserts one, updates item + list status.

CREATE OR REPLACE FUNCTION professor_complete_item(p_item_id uuid, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id uuid;
  v_item jsonb;
  v_now timestamptz := now();
BEGIN
  SELECT ti.task_list_id
  INTO v_list_id
  FROM task_items ti
  INNER JOIN task_lists tl ON tl.id = ti.task_list_id
  WHERE ti.id = p_item_id
    AND tl.org_id = p_org_id
    AND tl.deleted_at IS NULL;

  IF v_list_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE task_items
  SET
    status = 'verified',
    completed_by = NULL,
    completed_at = v_now,
    verified_at = v_now,
    updated_at = v_now
  WHERE id = p_item_id
  RETURNING to_jsonb(task_items.*) INTO v_item;

  DELETE FROM completions
  WHERE task_item_id = p_item_id
    AND member_id IS NULL;

  INSERT INTO completions (
    task_item_id,
    member_id,
    status,
    completed_at,
    verified_at,
    note
  )
  VALUES (
    p_item_id,
    NULL,
    'verified',
    v_now,
    v_now,
    'Marked done directly by Professor'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM task_items
    WHERE task_list_id = v_list_id
      AND status = 'pending'
  ) THEN
    UPDATE task_lists
    SET status = 'completed', updated_at = v_now
    WHERE id = v_list_id
      AND status <> 'archived';
  END IF;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION professor_complete_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION professor_complete_item(uuid, uuid) TO service_role;
