"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TaskListCard } from "@/components/admin/TaskListCard";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/ui/Toast";
import { formatDate, cn, getDateRange, calendarDateInTimeZone } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type {
  DashboardData,
  DashboardOverdueItem,
  DashboardPendingVerifyItem,
  DashboardRecentList,
  DashboardReminderReady,
} from "@/types";
import {
  AlertTriangle,
  Bell,
  CopyPlus,
  Download,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";
import { ShareSheet } from "@/components/admin/ShareSheet";

function getGreeting(name?: string) {
  const hour = new Date().getHours();
  let timeGreeting = "Good morning";
  if (hour >= 12 && hour < 17) {
    timeGreeting = "Good afternoon";
  } else if (hour >= 17) {
    timeGreeting = "Good evening";
  }
  return name ? `${timeGreeting}, ${name}` : timeGreeting;
}

function periodCopy(filter: "today" | "week" | "month" | "custom") {
  if (filter === "today") return "today";
  if (filter === "week") return "this week";
  if (filter === "month") return "this month";
  return "this range";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session } = useSession({ requireAuth: true });
  const { toast } = useToast();

  // Filters State
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "custom">("today");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const adminTz = session?.timezone || DEFAULT_TIMEZONE;
  const [customFrom, setCustomFrom] = useState<string>(() =>
    calendarDateInTimeZone(new Date(), DEFAULT_TIMEZONE)
  );
  const [customTo, setCustomTo] = useState<string>(() =>
    calendarDateInTimeZone(new Date(), DEFAULT_TIMEZONE)
  );
  const [showOverdueExpanded, setShowOverdueExpanded] = useState(false);
  const [tickingItemId, setTickingItemId] = useState<string | null>(null);
  const [duplicatingYesterday, setDuplicatingYesterday] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);
  const [reminderSheetData, setReminderSheetData] = useState<{
    taskList: {
      id: string;
      token: string;
      title: string;
      group_name: string;
      list_date: string;
      due_at?: string | null;
      member_link?: string;
    };
    items: Array<{ id: string; text: string; status: string; assigned_member_id?: string | null }>;
    members: Array<{ id: string; name: string; phone?: string | null; active?: boolean }>;
    kind: "due_soon" | "overdue";
  } | null>(null);

  // Compute date range query params in admin timezone
  const { fromStr, toStr } = useMemo(() => {
    const range = getDateRange(dateFilter, customFrom, customTo, adminTz);
    return { fromStr: range.from, toStr: range.to };
  }, [dateFilter, customFrom, customTo, adminTz]);

  // Fetch groups for filter dropdown
  const { data: groupsResponse } = useSWRFetch<any>("/api/admin/groups?limit=100");
  const allGroups = Array.isArray(groupsResponse)
    ? groupsResponse
    : groupsResponse?.data || [];

  // Build query string for dashboard endpoint
  const queryParams = new URLSearchParams({
    from: fromStr,
    to: toStr,
  });
  if (selectedGroupId) {
    queryParams.set("group_id", selectedGroupId);
  }

  // SWR polling every 15s
  const {
    data: dashboardData,
    isLoading,
    isValidating,
    mutate,
  } = useSWRFetch<DashboardData>(`/api/admin/dashboard?${queryParams.toString()}`);

  const recentLists = dashboardData?.recent_lists || dashboardData?.todayLists || [];
  const groupStats = dashboardData?.groups || [];
  const overdueItems = dashboardData?.overdue_items || [];
  const pendingVerifyItems = dashboardData?.pending_verify_items || [];
  const remindersReady = dashboardData?.reminders_ready || [];
  const kpis = dashboardData?.kpis;
  const createdCount = kpis?.total_created ?? 0;
  const doneCount = kpis?.total_done ?? 0;
  const pendingCount = kpis?.total_pending ?? 0;
  const completionRate = kpis?.completion_rate ?? 0;

  const { data: activeListsData } = useSWRFetch<
    DashboardRecentList[] | { data: DashboardRecentList[] }
  >("/api/admin/task-lists?status=active&limit=6");
  const activeLists: DashboardRecentList[] = Array.isArray(activeListsData)
    ? activeListsData
    : activeListsData?.data || [];
  const showActiveFallback =
    dateFilter === "today" && recentLists.length === 0 && activeLists.length > 0;
  const hasNeedsYou =
    overdueItems.length > 0 ||
    pendingVerifyItems.length > 0 ||
    remindersReady.length > 0;
  const dashboardLists: DashboardRecentList[] = (
    showActiveFallback ? activeLists : recentLists
  ).slice(0, 5);

  const openListReminder = async (row: DashboardReminderReady) => {
    try {
      setReminderLoadingId(row.id);
      const res = await fetch(`/api/admin/task-lists/${row.id}`);
      const json = await res.json();
      if (!res.ok || !json.data?.task_list) {
        throw new Error(json.error?.message || "Could not load checklist");
      }
      const detail = json.data;
      setReminderSheetData({
        taskList: {
          id: detail.task_list.id,
          token: detail.task_list.token,
          title: detail.task_list.title,
          group_name: detail.task_list.group_name,
          list_date: detail.task_list.list_date,
          due_at: detail.task_list.due_at,
          member_link: detail.task_list.member_link,
        },
        items: detail.items || [],
        members: detail.members || [],
        kind: row.kind,
      });
      setReminderSheetOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to open reminder");
    } finally {
      setReminderLoadingId(null);
    }
  };

  const markReminderDispatched = async (
    listId: string,
    kind: "due_soon" | "overdue"
  ) => {
    try {
      await fetch(`/api/admin/task-lists/${listId}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_sent", kind }),
      });
      mutate();
    } catch {
      /* non-blocking */
    }
  };

  const snoozeReminder = async (listId: string) => {
    try {
      await fetch(`/api/admin/task-lists/${listId}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze", hours: 4 }),
      });
      toast.success("Snoozed for 4 hours");
      mutate();
    } catch {
      toast.error("Could not snooze reminder");
    }
  };

  // Quick Action: Professor ticks an item done directly from dashboard
  const handleQuickTick = async (item: DashboardOverdueItem) => {
    try {
      setTickingItemId(item.id);
      const res = await fetch(`/api/admin/items/${item.id}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark item done");

      toast.success(`Completed & verified: "${item.text}"`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete item");
    } finally {
      setTickingItemId(null);
    }
  };

  // Quick Action: Verify a member-ticked (done) item
  const handleQuickVerify = async (
    item: DashboardOverdueItem | DashboardPendingVerifyItem
  ) => {
    try {
      setTickingItemId(item.id);
      const res = await fetch(`/api/admin/items/${item.id}/verify`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to verify item");
      }
      toast.success(`Verified: "${item.text}"`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to verify item");
    } finally {
      setTickingItemId(null);
    }
  };

  // Quick Action: Remind via ShareSheet (one-tap group message)
  const handleQuickRemind = (item: DashboardOverdueItem) => {
    void openListReminder({
      id: item.task_list_id,
      token: item.task_list_token,
      title: item.task_list_title,
      group_id: item.group_id,
      group_name: item.group_name,
      due_at: item.due_at,
      kind: "overdue",
      pending_count: 1,
      total_items: 1,
      label: "Overdue — send nudge",
    });
  };

  // Monthly backup reminder (1st of month in admin TZ, once per month)
  React.useEffect(() => {
    if (typeof window === "undefined" || !session?.timezone) return;
    const todayInTz = calendarDateInTimeZone(new Date(), session.timezone || adminTz);
    const dayNum = Number(todayInTz.split("-")[2]);
    if (dayNum !== 1) return;
    const key = `wtt_backup_toast_${todayInTz.slice(0, 7)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    toast.info("It's the 1st — download a CSV backup from Settings when you have a minute.");
  }, [toast, session?.timezone, adminTz]);

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const qs = new URLSearchParams({ from: fromStr, to: toStr });
      if (selectedGroupId) qs.set("group_id", selectedGroupId);
      const res = await fetch(`/api/admin/export?${qs.toString()}`);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || contentType.includes("application/json")) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Export failed — check you are logged in");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-export-${fromStr}_${toStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV export downloaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export CSV");
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDuplicateYesterday = async () => {
    try {
      setDuplicatingYesterday(true);
      const res = await fetch("/api/admin/task-lists/duplicate-yesterday", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to duplicate yesterday's lists");
      }
      const { created, skipped, from_date } = json.data || {};
      if (created === 0 && skipped === 0) {
        toast.info(json.data?.message || `No lists found for ${from_date}`);
      } else {
        toast.success(
          `Duplicated ${created} list(s) from ${from_date}${skipped ? ` (${skipped} already existed)` : ""}`
        );
        mutate();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setDuplicatingYesterday(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/task-lists/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to archive task list");
      toast.success("Task list archived");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive task list");
    }
  };

  const displayedOverdueItems = showOverdueExpanded
    ? overdueItems
    : overdueItems.slice(0, 5);

  const [greeting, setGreeting] = useState(
    session?.name ? session.name : "Dashboard"
  );
  const [todayFormatted, setTodayFormatted] = useState("");

  useEffect(() => {
    setGreeting(getGreeting(session?.name));
    setTodayFormatted(
      formatDate(new Date(), undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }, [session?.name]);

  return (
    <AdminLayout
      title={greeting}
      subtitle={todayFormatted}
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2"
            title="Refresh dashboard"
          >
            <RefreshCw
              className={cn("w-4 h-4", isValidating && "animate-spin text-[var(--color-primary)]")}
            />
          </Button>

          <Link href="/admin/tasks/new">
            <Button size="sm" variant="primary" className="gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" />
              <span>New Task List</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-4 pb-6">
        <section className="rounded-[var(--radius-lg)] glass-card px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <p className="text-xs font-semibold text-[var(--color-text-primary)] min-w-0 flex-1">
            {showActiveFallback
              ? `No lists dated today · ${activeLists.length} still running`
              : `${recentLists.length === 1 ? "1 list" : `${recentLists.length} lists`} · ${createdCount} items ${periodCopy(dateFilter)}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full glass-chrome p-1 border border-[var(--color-border-primary)]">
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "week", label: "Week" },
                  { id: "month", label: "Month" },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDateFilter(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                    dateFilter === tab.id
                      ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {allGroups.length > 0 && (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="field-control h-9 py-1 rounded-full"
                title="Filter by group"
              >
                <option value="">All groups</option>
                {allGroups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {dateFilter === "custom" && (
            <div className="flex items-center gap-2 text-xs w-full lg:w-auto">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="field-control h-9 py-1"
              />
              <span className="text-[var(--color-text-tertiary)]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="field-control h-9 py-1"
              />
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="ink-card px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
              Completion
            </p>
            <p className="text-2xl font-bold text-white tracking-tight mt-1">
              {isLoading ? "—" : `${completionRate}%`}
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              {doneCount}/{createdCount} {periodCopy(dateFilter)}
            </p>
          </div>
          <div className="glass-card px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Pending
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
              {isLoading ? "—" : pendingCount}
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
              Open items
            </p>
          </div>
          <a href="#needs-you" className="glass-card px-3.5 py-3 hover:border-[var(--color-status-overdue-fg)]/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-status-overdue-fg)]">
              Overdue
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
              {isLoading ? "—" : overdueItems.length}
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
              Needs a nudge
            </p>
          </a>
          <a href="#needs-you" className="glass-card px-3.5 py-3 hover:border-[var(--color-status-done-fg)]/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-status-done-fg)]">
              To verify
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
              {isLoading ? "—" : pendingVerifyItems.length}
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
              {remindersReady.length === 1
                ? "1 reminder"
                : `${remindersReady.length} reminders`}
            </p>
          </a>
        </section>

        {hasNeedsYou && (
          <section id="needs-you" className="rounded-[var(--radius-lg)] glass-card overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[var(--color-border-primary)] flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Needs you</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-status-overdue-bg)] text-[var(--color-status-overdue-fg)]">
                {overdueItems.length + pendingVerifyItems.length + remindersReady.length} open
              </span>
            </div>
            <div className="divide-y divide-[var(--color-border-secondary)]">
              {remindersReady.map((row) => (
                <div
                  key={`${row.id}-${row.kind}`}
                  className="flex items-center gap-3 px-3.5 py-2"
                >
                  <Bell className="w-3.5 h-3.5 text-[var(--color-warning)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {row.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                      {row.kind === "overdue" ? "Overdue" : "Due soon"} · {row.group_name} · {row.pending_count} pending
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-[11px] h-7 px-2 hidden sm:inline-flex"
                    onClick={() => snoozeReminder(row.id)}
                  >
                    Snooze
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="whatsapp"
                    className="text-[11px] h-7 px-2.5"
                    disabled={reminderLoadingId === row.id}
                    onClick={() => openListReminder(row)}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    {reminderLoadingId === row.id ? "…" : "Remind"}
                  </Button>
                </div>
              ))}
              {displayedOverdueItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3.5 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-status-overdue)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {item.text}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                      {item.group_name} · {item.task_list_title} · {item.time_overdue_label}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-[11px] h-7 px-2 hidden sm:inline-flex"
                    onClick={() => handleQuickTick(item)}
                    disabled={tickingItemId === item.id}
                  >
                    {tickingItemId === item.id ? "…" : "Done"}
                  </Button>
                  <Button
                    size="sm"
                    variant="whatsapp"
                    className="text-[11px] h-7 px-2.5"
                    onClick={() => handleQuickRemind(item)}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    Remind
                  </Button>
                </div>
              ))}
              {overdueItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowOverdueExpanded(!showOverdueExpanded)}
                  className="w-full px-3.5 py-1.5 text-[11px] font-semibold text-[var(--color-primary-text)] hover:bg-[var(--color-surface-sunken)]/50 flex items-center justify-center gap-1"
                >
                  {showOverdueExpanded ? (
                    <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
                  ) : (
                    <>View all {overdueItems.length} overdue <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </button>
              )}
              {pendingVerifyItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3.5 py-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-status-done)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {item.text}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                      {item.group_name} · {item.task_list_title}
                      {item.completed_by_name ? ` · ${item.completed_by_name}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="text-[11px] h-7 px-2.5"
                    onClick={() => handleQuickVerify(item)}
                    disabled={tickingItemId === item.id}
                  >
                    {tickingItemId === item.id ? "…" : "Verify"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          <section className="lg:col-span-3 rounded-[var(--radius-lg)] glass-card overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[var(--color-border-primary)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {showActiveFallback
                      ? "Still active"
                      : dateFilter === "today"
                      ? "Today's lists"
                      : "Lists in this period"}
                  </h2>
                  <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                    {showActiveFallback ? activeLists.length : recentLists.length}
                  </span>
                </div>
                {showActiveFallback && (
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">
                    Nothing dated today — share these again, or create one for today.
                  </p>
                )}
              </div>
              <Link
                href="/admin/tasks"
                className="text-[11px] font-semibold text-[var(--color-primary-text)] hover:underline flex items-center gap-0.5 shrink-0"
              >
                All lists <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {showActiveFallback && (
              <div className="px-3.5 py-2 border-b border-[var(--color-border-primary)] flex items-center gap-2 bg-[var(--color-surface-sunken)]/40">
                <p className="text-[11px] text-[var(--color-text-secondary)] min-w-0 flex-1 truncate">
                  No checklist dated today
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={handleDuplicateYesterday}
                  disabled={duplicatingYesterday}
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  {duplicatingYesterday ? "…" : "Duplicate"}
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => router.push("/admin/tasks/new")}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create
                </Button>
              </div>
            )}

            {isLoading && recentLists.length === 0 && !showActiveFallback ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : dashboardLists.length === 0 ? (
              <div className="px-3.5 py-8 text-center">
                <ClipboardList className="w-7 h-7 mx-auto text-[var(--color-text-tertiary)] mb-2" />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {dateFilter === "today" ? "Nothing dispatched today" : "No lists in this period"}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 mb-3">
                  Create a checklist and share it to WhatsApp.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={handleDuplicateYesterday}
                  >
                    Duplicate yesterday
                  </Button>
                  <Button size="sm" className="h-8" onClick={() => router.push("/admin/tasks/new")}>
                    Create list
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-secondary)]">
                {dashboardLists.map((list) => (
                  <TaskListCard
                    key={list.id}
                    compact
                    id={list.id}
                    token={list.token}
                    title={list.title}
                    groupName={list.group_name}
                    listDate={list.list_date}
                    dueAt={list.due_at}
                    status={list.status || "active"}
                    totalItems={list.total_items}
                    completedItems={list.completed_items}
                    recurrence={
                      list.recurrence as {
                        freq?: string;
                        auto_generated?: boolean;
                      } | null
                    }
                    onDelete={handleDeleteList}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="lg:col-span-2 rounded-[var(--radius-lg)] glass-card overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[var(--color-border-primary)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Groups</h2>
                <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                  {groupStats.length}
                </span>
              </div>
              <Link
                href="/admin/groups"
                className="text-[11px] font-semibold text-[var(--color-primary-text)] hover:underline flex items-center gap-0.5"
              >
                Manage <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading && groupStats.length === 0 ? (
              <div className="p-3 space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : groupStats.length === 0 ? (
              <div className="px-3.5 py-6 text-center">
                <Users className="w-6 h-6 mx-auto text-[var(--color-text-tertiary)] mb-2" />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">No groups yet</p>
                <Button
                  size="sm"
                  className="h-8 mt-2"
                  onClick={() => router.push("/admin/groups/new")}
                >
                  Create group
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-secondary)]">
                {groupStats.slice(0, 5).map((grp) => (
                  <Link
                    key={grp.id}
                    href={`/admin/groups/${grp.id}`}
                    className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--color-surface-sunken)]/60 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {grp.name}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">
                        {grp.members_opened}/{grp.members_total} opened
                        {grp.overdue > 0
                          ? ` · ${grp.overdue} overdue`
                          : grp.pending > 0
                          ? ` · ${grp.pending} pending`
                          : ""}
                      </p>
                    </div>
                    <div className="w-14 shrink-0 hidden sm:block">
                      <ProgressBar
                        value={grp.done}
                        max={Math.max(grp.created, 1)}
                        showLabel={false}
                        size="sm"
                        animateColor
                      />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--color-text-secondary)] w-8 text-right tabular-nums">
                      {grp.completion_rate}%
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--color-border-primary)] px-2 py-2 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={handleDuplicateYesterday}
                disabled={duplicatingYesterday}
                className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                <CopyPlus className="w-4 h-4" />
                {duplicatingYesterday ? "…" : "Duplicate"}
              </button>
              <Link
                href="/admin/reports"
                className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]"
              >
                <BarChart3 className="w-4 h-4" />
                Reports
              </Link>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exportingCsv ? "…" : "Export"}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {reminderSheetData && (
        <ShareSheet
          isOpen={reminderSheetOpen}
          initialMode="reminder"
          initialReminderType={
            reminderSheetData.kind === "overdue" ? "overdue" : "group"
          }
          onClose={() => {
            setReminderSheetOpen(false);
            setReminderSheetData(null);
          }}
          taskList={reminderSheetData.taskList}
          items={reminderSheetData.items}
          members={reminderSheetData.members}
          onDispatched={() => {
            markReminderDispatched(
              reminderSheetData.taskList.id,
              reminderSheetData.kind
            );
          }}
        />
      )}
    </AdminLayout>
  );
}
