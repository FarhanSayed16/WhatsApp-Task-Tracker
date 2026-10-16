"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TaskListCard } from "@/components/admin/TaskListCard";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/ui/Toast";
import { formatDate, cn, getDateRange, calendarDateInTimeZone } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type {
  DashboardData,
  DashboardOverdueItem,
  DashboardPendingVerifyItem,
  DashboardReminderReady,
} from "@/types";
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
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
import { formatWaDueTime } from "@/lib/whatsapp";

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
    : overdueItems.slice(0, 3);

  const greeting = getGreeting(session?.name);
  const todayFormatted = formatDate(new Date(), undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hasActionRequired = overdueItems.length > 0 || pendingVerifyItems.length > 0;

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
      <div className="space-y-8 pb-12">
        {/* REMINDERS READY — one-tap WhatsApp (free automation) */}
        {remindersReady.length > 0 && (
          <section className="rounded-xl border border-[var(--color-warning)]/35 bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--color-border-primary)] flex items-center justify-between bg-[var(--color-warning-bg)]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--color-warning)]" />
                <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                  Reminders ready
                </h2>
              </div>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {remindersReady.length} list{remindersReady.length === 1 ? "" : "s"} · one tap to WhatsApp
              </span>
            </div>
            <div className="p-4 space-y-2">
              {remindersReady.map((row) => (
                <div
                  key={`${row.id}-${row.kind}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-surface)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                          row.kind === "overdue"
                            ? "bg-[var(--color-status-overdue-bg)] text-[var(--color-status-overdue-fg)]"
                            : "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-fg)]"
                        )}
                      >
                        {row.kind === "overdue" ? "Overdue" : "Due soon"}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                        {row.group_name}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {row.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                      {row.pending_count} pending · Due {formatWaDueTime(row.due_at) || row.due_at}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[11px] h-8"
                      onClick={() => snoozeReminder(row.id)}
                    >
                      Snooze 4h
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="whatsapp"
                      className="text-[11px] h-8"
                      disabled={reminderLoadingId === row.id}
                      onClick={() => openListReminder(row)}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 mr-1" />
                      {reminderLoadingId === row.id ? "Loading…" : "Send reminder"}
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-[var(--color-text-tertiary)] px-1 pt-1">
                Opens a ready-made WhatsApp message — pick your class group and send. No paid WhatsApp Business API needed.
              </p>
            </div>
          </section>
        )}

        {/* ACTION REQUIRED BANNER (Conditional: only shown when items need attention) */}
        {hasActionRequired && (
          <section className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--color-border-primary)] flex items-center justify-between bg-[var(--color-surface-sunken)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-overdue)] animate-pulse" />
                <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                  Action required
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                {overdueItems.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[var(--color-status-overdue)]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {overdueItems.length} overdue
                  </span>
                )}
                {overdueItems.length > 0 && pendingVerifyItems.length > 0 && <span>·</span>}
                {pendingVerifyItems.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[var(--color-status-done)]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {pendingVerifyItems.length} awaiting verification
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Overdue items preview */}
              {overdueItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      Overdue Items
                    </span>
                    {overdueItems.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowOverdueExpanded(!showOverdueExpanded)}
                        className="text-xs font-medium text-[var(--color-primary-text)] hover:underline flex items-center gap-1"
                      >
                        {showOverdueExpanded ? (
                          <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>View all ({overdueItems.length}) <ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayedOverdueItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-surface)] shadow-xs flex flex-col justify-between gap-3 hover:border-[var(--color-status-overdue)]/40 transition-all border-l-4 border-l-[var(--color-status-overdue)]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] truncate">
                              {item.group_name}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--color-status-overdue)] flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {item.time_overdue_label}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[var(--color-text-primary)] line-clamp-2">
                            {item.text}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 truncate">
                            {item.task_list_title}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border-secondary)]">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 text-[11px] h-7"
                            onClick={() => handleQuickTick(item)}
                            disabled={tickingItemId === item.id}
                          >
                            <Check className="w-3 h-3 mr-1 text-[var(--color-primary)]" />
                            {tickingItemId === item.id ? "Saving…" : "Mark Done"}
                          </Button>
                          <Button
                            size="sm"
                            variant="whatsapp"
                            className="flex-1 text-[11px] h-7"
                            onClick={() => handleQuickRemind(item)}
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 mr-1" />
                            Remind
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending verification items */}
              {pendingVerifyItems.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Awaiting Verification
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pendingVerifyItems.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-surface)] p-3 space-y-2 border-l-4 border-l-[var(--color-status-done)]"
                      >
                        <p className="text-xs font-semibold text-[var(--color-text-primary)] line-clamp-2">
                          {item.text}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                          {item.group_name} · {item.task_list_title}
                          {item.completed_by_name ? ` · by ${item.completed_by_name}` : ""}
                        </p>
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full text-[11px] h-7"
                          onClick={() => handleQuickVerify(item)}
                          disabled={tickingItemId === item.id}
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          {tickingItemId === item.id ? "Verifying…" : "Confirm & Verify"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TODAY'S TASK LISTS (with subtle inline filter tabs) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  {dateFilter === "today" ? "Today's Task Lists" : "Task Lists"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                  {recentLists.length}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Active checklists for student dispatch & tracking
              </p>
            </div>

            {/* Inline subtle filter controls */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-[var(--color-surface-sunken)] p-1 border border-[var(--color-border-primary)]">
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
                      "px-3 py-1 rounded-md text-xs font-medium transition-all",
                      dateFilter === tab.id
                        ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs font-semibold"
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
                  className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-primary)] text-xs px-2.5 py-1.5 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                  title="Filter by group"
                >
                  <option value="">All Groups</option>
                  {allGroups.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}

              <Link
                href="/admin/tasks"
                className="text-xs font-medium text-[var(--color-primary-text)] hover:underline flex items-center gap-0.5 ml-1 shrink-0"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Custom Date Inputs if active */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-2 text-xs pt-1">
              <span className="text-[var(--color-text-tertiary)]">Range:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-[var(--color-border-primary)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)]"
              />
              <span className="text-[var(--color-text-tertiary)]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-[var(--color-border-primary)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)]"
              />
            </div>
          )}

          {/* List Cards Grid */}
          {isLoading && recentLists.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="card" className="h-60" />
              ))}
            </div>
          ) : recentLists.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8 text-[var(--color-text-tertiary)]" />}
              title="No task lists for today yet"
              description="Create a task checklist and share it directly with your students on WhatsApp, or duplicate yesterday's lists."
              actionLabel="+ Create Task List"
              onAction={() => router.push("/admin/tasks/new")}
              secondaryActionLabel="Duplicate Yesterday"
              onSecondaryAction={handleDuplicateYesterday}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentLists.map((list) => (
                <TaskListCard
                  key={list.id}
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

        {/* GROUP SNAPSHOT */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  Group Snapshot
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                  {groupStats.length}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Current progress and activity across your student rosters
              </p>
            </div>

            <Link
              href="/admin/groups"
              className="text-xs font-medium text-[var(--color-primary-text)] hover:underline flex items-center gap-0.5"
            >
              Manage groups <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading && groupStats.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="card" className="h-32" />
              ))}
            </div>
          ) : groupStats.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-[var(--color-text-tertiary)]" />}
              title="No groups found"
              description="Create student groups to organize tasks and track team submissions."
              actionLabel="+ Create Group"
              onAction={() => router.push("/admin/groups/new")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupStats.map((grp) => (
                <Link
                  key={grp.id}
                  href={`/admin/groups/${grp.id}`}
                  className="group block"
                >
                  <div className="p-4 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 hover:shadow-sm transition-all flex flex-col justify-between h-full space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors truncate">
                          {grp.name}
                        </h3>
                        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] shrink-0 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {grp.members_total}
                        </span>
                      </div>

                      <div className="space-y-1 mt-2">
                        <ProgressBar
                          value={grp.done}
                          max={Math.max(grp.created, 1)}
                          showLabel={false}
                          size="sm"
                          animateColor={true}
                        />
                        <div className="flex justify-between items-center text-[11px] text-[var(--color-text-secondary)]">
                          <span>{grp.done} of {grp.created} done</span>
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {grp.completion_rate}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--color-border-secondary)] flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
                      <span>{grp.members_opened} of {grp.members_total} opened links</span>
                      <span className="text-[var(--color-primary-text)] font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                        Details <ChevronRight className="w-3 h-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* QUICK ACTIONS ROW (Bottom) */}
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-tertiary)]">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Duplicate Yesterday */}
            <button
              type="button"
              onClick={handleDuplicateYesterday}
              disabled={duplicatingYesterday}
              className="p-4 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary)]/40 transition-all text-left flex items-start gap-3 disabled:opacity-50"
            >
              <div className="p-2.5 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shrink-0">
                <CopyPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                  {duplicatingYesterday ? "Duplicating…" : "Duplicate Yesterday"}
                </h3>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                  Clone yesterday’s lists into today as new drafts
                </p>
              </div>
            </button>

            {/* Reports */}
            <Link
              href="/admin/reports"
              className="p-4 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary)]/40 transition-all text-left flex items-start gap-3"
            >
              <div className="p-2.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                  View Reports
                </h3>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                  Completion analytics & PDF export
                </p>
              </div>
            </Link>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="p-4 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-primary)]/40 transition-all text-left flex items-start gap-3 disabled:opacity-50"
            >
              <div className="p-2.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                  {exportingCsv ? "Exporting…" : "Export CSV"}
                </h3>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                  Download spreadsheet records for selected period
                </p>
              </div>
            </button>
          </div>
        </section>
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
