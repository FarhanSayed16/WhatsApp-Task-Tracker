import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateGroupSchema, validateBody } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;

    // 1. Fetch group
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (groupErr || !group) {
      return apiError("Group not found", "NOT_FOUND", 404);
    }

    // 2. Fetch all members in this group
    const { data: members, error: membersErr } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (membersErr) throw membersErr;

    const memberList = members || [];
    const memberIds = memberList.map((m) => m.id);

    // Compute completions per member
    let memberCompletions: Record<string, number> = {};
    if (memberIds.length > 0) {
      const { data: completions } = await supabase
        .from("completions")
        .select("id, member_id")
        .in("member_id", memberIds);

      if (completions) {
        for (const c of completions) {
          if (c.member_id) {
            memberCompletions[c.member_id] = (memberCompletions[c.member_id] || 0) + 1;
          }
        }
      }
    }

    const enrichedMembers = memberList.map((m) => ({
      ...m,
      completions_count: memberCompletions[m.id] || 0,
    }));

    // 3. Fetch recent task lists for this group
    const { data: taskLists, error: taskListsErr } = await supabase
      .from("task_lists")
      .select("*")
      .eq("group_id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .order("list_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (taskListsErr) throw taskListsErr;

    const listData = taskLists || [];
    const listIds = listData.map((l) => l.id);

    // Fetch items and completion counts for recent lists
    let itemsByList: Record<string, { total: number; completed: number }> = {};
    let totalTasks = 0;
    let completedTasks = 0;

    if (listIds.length > 0) {
      const { data: items } = await supabase
        .from("task_items")
        .select("id, task_list_id, status")
        .in("task_list_id", listIds);

      if (items) {
        for (const item of items) {
          if (!itemsByList[item.task_list_id]) {
            itemsByList[item.task_list_id] = { total: 0, completed: 0 };
          }
          itemsByList[item.task_list_id].total++;
          totalTasks++;

          if (item.status === "done" || item.status === "verified") {
            itemsByList[item.task_list_id].completed++;
            completedTasks++;
          }
        }
      }
    }

    const enrichedTaskLists = listData.map((l) => {
      const counts = itemsByList[l.id] || { total: 0, completed: 0 };
      return {
        ...l,
        total_items: counts.total,
        completed_items: counts.completed,
      };
    });

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return apiSuccess({
      group,
      members: enrichedMembers,
      recent_task_lists: enrichedTaskLists,
      stats: {
        total_members: memberList.length,
        total_lists: listData.length,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        completion_rate: completionRate,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const body = await req.json();
    const data = validateBody(updateGroupSchema, body);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.verify_required !== undefined)
      updatePayload.verify_required = data.verify_required;
    if (data.sort_order !== undefined) updatePayload.sort_order = data.sort_order;

    const { data: updatedGroup, error } = await supabase
      .from("groups")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !updatedGroup) {
      return apiError("Group not found or update failed", "NOT_FOUND", 404);
    }

    return apiSuccess(updatedGroup);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const now = new Date().toISOString();

    // 1. Soft-delete the group
    const { error: groupError } = await supabase
      .from("groups")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (groupError) throw groupError;

    // 2. Cascade soft-delete members
    await supabase
      .from("members")
      .update({ deleted_at: now, active: false, updated_at: now })
      .eq("group_id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    // 3. Cascade soft-delete associated task_lists
    await supabase
      .from("task_lists")
      .update({ deleted_at: now, updated_at: now, status: "archived" })
      .eq("group_id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
