import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { createGroupSchema, validateBody } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("groups")
      .select("*", { count: "exact" })
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    query = query
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: groups, error, count } = await query;
    if (error) throw error;

    const groupList = groups || [];
    const groupIds = groupList.map((g) => g.id);

    // If groups found, aggregate member counts & task list stats
    let membersByGroup: Record<string, number> = {};
    let activeListsByGroup: Record<string, number> = {};
    let completionRateByGroup: Record<string, number> = {};
    let lastActivityByGroup: Record<string, string | null> = {};

    if (groupIds.length > 0) {
      // 1. Fetch active members count
      const { data: memberRows } = await supabase
        .from("members")
        .select("id, group_id")
        .in("group_id", groupIds)
        .is("deleted_at", null);

      if (memberRows) {
        for (const m of memberRows) {
          membersByGroup[m.group_id] = (membersByGroup[m.group_id] || 0) + 1;
        }
      }

      // 2. Fetch task lists for groups
      const { data: listRows } = await supabase
        .from("task_lists")
        .select("id, group_id, status, created_at, updated_at")
        .in("group_id", groupIds)
        .is("deleted_at", null);

      const taskListIds: string[] = [];
      const listsByGroupMap: Record<string, string[]> = {};

      if (listRows) {
        for (const l of listRows) {
          taskListIds.push(l.id);
          if (!listsByGroupMap[l.group_id]) listsByGroupMap[l.group_id] = [];
          listsByGroupMap[l.group_id].push(l.id);

          if (l.status === "active" || l.status === "draft") {
            activeListsByGroup[l.group_id] = (activeListsByGroup[l.group_id] || 0) + 1;
          }

          // Track latest activity
          const latestDate = l.updated_at || l.created_at;
          const currentLatest = lastActivityByGroup[l.group_id];
          if (!currentLatest || new Date(latestDate) > new Date(currentLatest)) {
            lastActivityByGroup[l.group_id] = latestDate;
          }
        }
      }

      // 3. Fetch completion status of items across these task lists
      if (taskListIds.length > 0) {
        const { data: itemRows } = await supabase
          .from("task_items")
          .select("id, task_list_id, status")
          .in("task_list_id", taskListIds);

        if (itemRows) {
          // Map task_list_id to item counts
          const totalByList: Record<string, number> = {};
          const doneByList: Record<string, number> = {};

          for (const item of itemRows) {
            totalByList[item.task_list_id] = (totalByList[item.task_list_id] || 0) + 1;
            if (item.status === "done" || item.status === "verified") {
              doneByList[item.task_list_id] = (doneByList[item.task_list_id] || 0) + 1;
            }
          }

          for (const [groupId, listIds] of Object.entries(listsByGroupMap)) {
            let groupTotalItems = 0;
            let groupDoneItems = 0;
            for (const listId of listIds) {
              groupTotalItems += totalByList[listId] || 0;
              groupDoneItems += doneByList[listId] || 0;
            }
            completionRateByGroup[groupId] =
              groupTotalItems > 0 ? Math.round((groupDoneItems / groupTotalItems) * 100) : 0;
          }
        }
      }
    }

    const enrichedGroups = groupList.map((g) => ({
      ...g,
      member_count: membersByGroup[g.id] || 0,
      active_task_list_count: activeListsByGroup[g.id] || 0,
      completion_rate: completionRateByGroup[g.id] || 0,
      last_activity_at: lastActivityByGroup[g.id] || g.updated_at || g.created_at,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiSuccess(enrichedGroups, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const data = validateBody(createGroupSchema, body);

    // Insert group
    const { data: newGroup, error: groupError } = await supabase
      .from("groups")
      .insert({
        org_id: admin.orgId,
        created_by: admin.adminId,
        name: data.name,
        description: data.description || null,
        verify_required: data.verify_required ?? true,
        sort_order: data.sort_order ?? 0,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Insert members if provided
    let insertedMembers = [];
    if (data.members && data.members.length > 0) {
      const memberInserts = data.members.map((m, index) => ({
        org_id: admin.orgId,
        group_id: newGroup.id,
        name: m.name,
        phone: m.phone || null,
        active: true,
        sort_order: index,
      }));

      const { data: members, error: membersError } = await supabase
        .from("members")
        .insert(memberInserts)
        .select();

      if (membersError) throw membersError;
      insertedMembers = members || [];
    }

    return apiSuccess(
      {
        ...newGroup,
        members: insertedMembers,
      },
      undefined,
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
