import { supabase } from "./supabase";

export type OrgScopedItem = {
  id: string;
  task_list_id: string;
  text: string;
  position: number;
  priority: string;
  assigned_member_id: string | null;
  due_at: string | null;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  task_lists: {
    id: string;
    org_id: string;
    status: string;
    deleted_at: string | null;
    group_id: string;
  };
};

/**
 * Load a task item only if its parent task list belongs to the admin's org.
 * Returns null when missing or cross-org.
 */
export async function getOrgScopedItem(
  itemId: string,
  orgId: string
): Promise<OrgScopedItem | null> {
  const { data, error } = await supabase
    .from("task_items")
    .select(
      `
      *,
      task_lists!inner (
        id,
        org_id,
        status,
        deleted_at,
        group_id
      )
    `
    )
    .eq("id", itemId)
    .eq("task_lists.org_id", orgId)
    .is("task_lists.deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as OrgScopedItem;
}

/**
 * After item status changes, mark the parent list completed when nothing is pending.
 */
export async function maybeCompleteTaskList(taskListId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: remainingPending } = await supabase
    .from("task_items")
    .select("id")
    .eq("task_list_id", taskListId)
    .eq("status", "pending")
    .limit(1);

  if (!remainingPending || remainingPending.length === 0) {
    await supabase
      .from("task_lists")
      .update({ status: "completed", updated_at: now })
      .eq("id", taskListId)
      .neq("status", "archived");
  }
}

/**
 * Professor direct-complete: update item + replace NULL-member completion
 * Prefer DB RPC when available; fall back to ordered ops with rollback on insert failure.
 */
export async function professorCompleteItem(
  itemId: string,
  orgId: string
): Promise<{ item: Record<string, unknown>; taskListId: string } | null> {
  const scoped = await getOrgScopedItem(itemId, orgId);
  if (!scoped) return null;

  const now = new Date().toISOString();
  const taskListId = scoped.task_list_id;

  // Prefer atomic RPC if migration is applied
  const { data: rpcItem, error: rpcError } = await supabase.rpc(
    "professor_complete_item",
    { p_item_id: itemId, p_org_id: orgId }
  );

  if (!rpcError && rpcItem) {
    return { item: rpcItem as Record<string, unknown>, taskListId };
  }

  // Fallback path (pre-migration / RPC missing)
  if (rpcError) {
    console.warn(
      "professor_complete_item RPC unavailable, using fallback:",
      rpcError.message
    );
  }

  const { data: updatedItem, error: updateErr } = await supabase
    .from("task_items")
    .update({
      status: "verified",
      completed_by: null,
      completed_at: now,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .select()
    .single();

  if (updateErr || !updatedItem) {
    throw updateErr || new Error("Failed to update task item");
  }

  await supabase
    .from("completions")
    .delete()
    .eq("task_item_id", itemId)
    .is("member_id", null);

  const { error: completionErr } = await supabase.from("completions").insert({
    task_item_id: itemId,
    member_id: null,
    status: "verified",
    completed_at: now,
    verified_at: now,
    note: "Marked done directly by Professor",
  });

  if (completionErr) {
    // Best-effort rollback of item status
    await supabase
      .from("task_items")
      .update({
        status: scoped.status,
        completed_by: scoped.completed_by,
        completed_at: scoped.completed_at,
        verified_at: scoped.verified_at,
        updated_at: now,
      })
      .eq("id", itemId);
    throw completionErr;
  }

  await maybeCompleteTaskList(taskListId);

  return { item: updatedItem, taskListId };
}
