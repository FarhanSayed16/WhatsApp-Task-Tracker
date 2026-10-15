import { calendarDateInTimeZone } from "./utils";
import { DEFAULT_TIMEZONE } from "./constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Yesterday's calendar date in a timezone */
export function yesterdayInTimeZone(timeZone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const todayStr = calendarDateInTimeZone(now, timeZone);
  const [y, m, d] = todayStr.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  noon.setUTCDate(noon.getUTCDate() - 1);
  return calendarDateInTimeZone(noon, timeZone);
}

export function dayOfWeekInTimeZone(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[name] ?? date.getUTCDay();
}

export type DigestSummary = {
  totalTasks: number;
  completedTasks: number;
  verifiedTasks: number;
  overdueTasks: number;
  completionRate: number;
  onTimeRate: number;
  activeGroups: number;
  activeMembers: number;
  avgResponseMinutes: number;
};

export type DigestPerformer = {
  name: string;
  completed: number;
  onTimeRate: number;
  avgResponseMinutes: number;
};

/**
 * Build digest KPIs + top/bottom performers for an org over [from, to] list_dates.
 */
export async function buildOrgDigestMetrics(
  supabase: SupabaseClient,
  orgId: string,
  from: string,
  to: string
): Promise<{
  summary: DigestSummary;
  topPerformers: DigestPerformer[];
  bottomPerformers: DigestPerformer[];
  overdueItems: Array<{ text: string; group_name: string; due_at: string }>;
}> {
  const nowIso = new Date().toISOString();

  const { data: dLists } = await supabase
    .from("task_lists")
    .select("id, group_id, shared_at, created_at, groups(name)")
    .eq("org_id", orgId)
    .gte("list_date", from)
    .lte("list_date", to)
    .is("deleted_at", null);

  const lists = dLists || [];
  const listIds = lists.map((l) => l.id);
  const listMeta = new Map(
    lists.map((l) => [
      l.id,
      {
        group_id: l.group_id,
        shared_at: l.shared_at as string | null,
        created_at: l.created_at as string,
        group_name: (() => {
          const g = l.groups as { name?: string } | { name?: string }[] | null;
          if (Array.isArray(g)) return g[0]?.name || "General";
          return g?.name || "General";
        })(),
      },
    ])
  );

  let dItems: Array<{
    id: string;
    text: string;
    status: string;
    due_at: string | null;
    completed_at: string | null;
    completed_by: string | null;
    task_list_id: string;
  }> = [];

  if (listIds.length > 0) {
    const { data: itemsFound } = await supabase
      .from("task_items")
      .select(
        "id, text, status, due_at, completed_at, completed_by, task_list_id"
      )
      .in("task_list_id", listIds);
    dItems = itemsFound || [];
  }

  const doneItems = dItems.filter(
    (i) => i.status === "done" || i.status === "verified"
  );
  const overdueItemsRaw = dItems.filter(
    (i) => i.status === "pending" && i.due_at && i.due_at < nowIso
  );
  const verifiedCount = dItems.filter((i) => i.status === "verified").length;
  const compRate =
    dItems.length > 0
      ? Math.round((doneItems.length / dItems.length) * 100)
      : 0;

  const onTimeDone = doneItems.filter((i) => {
    if (!i.due_at || !i.completed_at) return true;
    return new Date(i.completed_at).getTime() <= new Date(i.due_at).getTime();
  });
  const onTimeRate =
    doneItems.length > 0
      ? Math.round((onTimeDone.length / doneItems.length) * 100)
      : 100;

  const responseTimes: number[] = [];
  for (const it of doneItems) {
    if (!it.completed_at) continue;
    const meta = listMeta.get(it.task_list_id);
    const anchor = meta?.shared_at || meta?.created_at;
    if (!anchor) continue;
    const diffMs =
      new Date(it.completed_at).getTime() - new Date(anchor).getTime();
    if (diffMs > 0) responseTimes.push(Math.round(diffMs / (1000 * 60)));
  }
  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        )
      : 0;

  const memberIds = [
    ...new Set(
      doneItems.map((i) => i.completed_by).filter(Boolean) as string[]
    ),
  ];
  const memberNames: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, name")
      .in("id", memberIds);
    for (const m of members || []) memberNames[m.id] = m.name;
  }

  type Acc = {
    name: string;
    completed: number;
    onTime: number;
    responses: number[];
  };
  const byMember = new Map<string, Acc>();
  for (const it of doneItems) {
    if (!it.completed_by) continue;
    const acc = byMember.get(it.completed_by) || {
      name: memberNames[it.completed_by] || "Member",
      completed: 0,
      onTime: 0,
      responses: [],
    };
    acc.completed += 1;
    if (
      !it.due_at ||
      !it.completed_at ||
      new Date(it.completed_at).getTime() <= new Date(it.due_at).getTime()
    ) {
      acc.onTime += 1;
    }
    const meta = listMeta.get(it.task_list_id);
    const anchor = meta?.shared_at || meta?.created_at;
    if (anchor && it.completed_at) {
      const diffMs =
        new Date(it.completed_at).getTime() - new Date(anchor).getTime();
      if (diffMs > 0) acc.responses.push(Math.round(diffMs / (1000 * 60)));
    }
    byMember.set(it.completed_by, acc);
  }

  const performers: DigestPerformer[] = [...byMember.values()].map((a) => ({
    name: a.name,
    completed: a.completed,
    onTimeRate:
      a.completed > 0 ? Math.round((a.onTime / a.completed) * 100) : 100,
    avgResponseMinutes:
      a.responses.length > 0
        ? Math.round(a.responses.reduce((x, y) => x + y, 0) / a.responses.length)
        : 0,
  }));

  performers.sort((a, b) => {
    if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate;
    return b.completed - a.completed;
  });

  const topPerformers = performers.slice(0, 5);
  const bottomPerformers = [...performers]
    .sort((a, b) => {
      if (a.onTimeRate !== b.onTimeRate) return a.onTimeRate - b.onTimeRate;
      return a.completed - b.completed;
    })
    .slice(0, 3);

  const { count: memberCount } = await supabase
    .from("members")
    .select("id, groups!inner(org_id)", { count: "exact", head: true })
    .eq("groups.org_id", orgId)
    .is("deleted_at", null);

  return {
    summary: {
      totalTasks: dItems.length,
      completedTasks: doneItems.length,
      verifiedTasks: verifiedCount,
      overdueTasks: overdueItemsRaw.length,
      completionRate: compRate,
      onTimeRate,
      activeGroups: new Set(lists.map((l) => l.group_id)).size,
      activeMembers: memberCount || memberIds.length,
      avgResponseMinutes,
    },
    topPerformers,
    bottomPerformers,
    overdueItems: overdueItemsRaw.slice(0, 5).map((i) => ({
      text: i.text,
      group_name: listMeta.get(i.task_list_id)?.group_name || "General",
      due_at: i.due_at || "",
    })),
  };
}
