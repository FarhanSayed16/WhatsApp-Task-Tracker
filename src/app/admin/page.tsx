"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { KpiCard } from "@/components/admin/KpiCard";
import { TaskListCard } from "@/components/admin/TaskListCard";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/ui/Toast";
import { formatDate, cn, getDateRange, calendarDateInTimeZone } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { buildReminderMessage, waLink } from "@/lib/whatsapp";
import type {
  DashboardData,
  DashboardOverdueItem,
  DashboardPendingVerifyItem,
  DashboardGroupStat,
} from "@/types";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  RefreshCw,
  Send,
  Calendar,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Copy,
  FileText,
} from "lucide-react";

// Sleek animated SVG circular progress ring for group cards
function CircularProgress({
  value,
  size = 54,
  strokeWidth = 5,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const colorClass =
    clamped >= 80
      ? "text-emerald-500"
      : clamped >= 40
      ? "text-amber-500"
      : "text-rose-500";

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-100 dark:text-slate-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-700 ease-out", colorClass)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

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

  const kpis = dashboardData?.kpis;
  const trends = dashboardData?.trends;
  const recentLists = dashboardData?.recent_lists || dashboardData?.todayLists || [];
  const groupStats = dashboardData?.groups || [];
  const overdueItems = dashboardData?.overdue_items || [];
  const pendingVerifyItems = dashboardData?.pending_verify_items || [];

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

  // Quick Action: Remind via WhatsApp for overdue item
  const handleQuickRemind = (item: DashboardOverdueItem) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const memberLink = `${origin}/t/${item.task_list_token}`;
    const reminderMsg = buildReminderMessage({
      type: "overdue",
      title: item.task_list_title,
      groupName: item.group_name,
      pendingItems: [item.text],
      link: memberLink,
    });

    const url = waLink(reminderMsg);
    window.open(url, "_blank");
    toast.success("WhatsApp reminder opened");
  };

  // Delete list handler
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
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-2"
            title="Refresh dashboard"
          >
            <RefreshCw
              className={cn("w-4 h-4", isValidating && "animate-spin text-emerald-500")}
            />
          </Button>

          <Link href="/admin/tasks/new">
            <Button size="sm" variant="primary" className="gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Task List</span>
              <span className="sm:hidden">New List</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-8 pb-12">
        {/* Filter Controls Bar */}
        <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Date Range Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(
              [
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateFilter(tab.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                  dateFilter === tab.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Group Filter & Custom Range */}
          <div className="flex flex-wrap items-center gap-3">
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">All Groups</option>
                {allGroups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Overdue Alerts Section (Prominent if > 0) */}
        {overdueItems.length > 0 && (
          <section className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                      Overdue Tasks Attention Required
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                      {overdueItems.length}
                    </span>
                  </div>
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                    Students have pending items past due. Send a reminder or mark them done.
                  </p>
                </div>
              </div>

              {overdueItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowOverdueExpanded(!showOverdueExpanded)}
                  className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1"
                >
                  {showOverdueExpanded ? (
                    <>
                      Show less <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      View all ({overdueItems.length}){" "}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedOverdueItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/40 shadow-xs flex flex-col justify-between gap-3 hover:border-rose-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate">
                        {item.group_name}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {item.time_overdue_label}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {item.text}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      List: {item.task_list_title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[11px] py-1 text-slate-700 dark:text-slate-300"
                      onClick={() => handleQuickTick(item)}
                      disabled={tickingItemId === item.id}
                    >
                      <Check className="w-3 h-3 mr-1 text-emerald-600" />
                      {tickingItemId === item.id ? "Saving..." : "Mark Done"}
                    </Button>

                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1 text-[11px] py-1 bg-[#25D366] hover:bg-[#20ba5a] text-white"
                      onClick={() => handleQuickRemind(item)}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Remind
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Awaiting Verification (quick-verify) */}
        {pendingVerifyItems.length > 0 && (
          <section className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                    Awaiting Your Verification
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white">
                    {pendingVerifyItems.length}
                  </span>
                </div>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                  Members marked these done — confirm to verify
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingVerifyItems.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40 p-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {item.text}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.group_name} · {item.task_list_title}
                    {item.completed_by_name
                      ? ` · by ${item.completed_by_name}`
                      : ""}
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full text-[11px] py-1"
                    onClick={() => handleQuickVerify(item)}
                    disabled={tickingItemId === item.id}
                  >
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    {tickingItemId === item.id ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* KPI Cards Row (4 cards) */}
        <section>
          {isLoading && !kpis ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Created */}
              <KpiCard
                label="Total Created"
                value={kpis?.total_created ?? 0}
                icon={<ClipboardList className="w-5 h-5" />}
                color="blue"
                trend={
                  trends
                    ? {
                        value: `${trends.created_change >= 0 ? "+" : ""}${
                          trends.created_change
                        }%`,
                        direction:
                          trends.created_change > 0
                            ? "up"
                            : trends.created_change < 0
                            ? "down"
                            : "neutral",
                        label: "vs previous period",
                      }
                    : undefined
                }
              />

              {/* Completed */}
              <KpiCard
                label="Completed"
                value={kpis?.total_done ?? 0}
                icon={<CheckCircle2 className="w-5 h-5" />}
                color="emerald"
                trend={
                  kpis
                    ? {
                        value: `${kpis.completion_rate}%`,
                        direction: kpis.completion_rate >= 50 ? "up" : "neutral",
                        label: "completion rate",
                      }
                    : undefined
                }
              />

              {/* Pending */}
              <KpiCard
                label="Pending"
                value={kpis?.total_pending ?? 0}
                icon={<Clock className="w-5 h-5" />}
                color="amber"
                trend={
                  trends
                    ? {
                        value: `${trends.pending_change >= 0 ? "+" : ""}${
                          trends.pending_change
                        }%`,
                        direction:
                          trends.pending_change < 0
                            ? "up"
                            : trends.pending_change > 0
                            ? "down"
                            : "neutral",
                        label: "pending delta",
                      }
                    : undefined
                }
              />

              {/* Overdue */}
              <KpiCard
                label="Overdue"
                value={kpis?.total_overdue ?? 0}
                icon={<AlertTriangle className="w-5 h-5" />}
                color="rose"
                className={cn(
                  (kpis?.total_overdue ?? 0) > 0 &&
                    "border-rose-400 dark:border-rose-700/80 shadow-rose-500/10"
                )}
                trend={
                  trends
                    ? {
                        value: `${trends.overdue_change >= 0 ? "+" : ""}${
                          trends.overdue_change
                        }%`,
                        direction:
                          trends.overdue_change > 0
                            ? "down"
                            : trends.overdue_change < 0
                            ? "up"
                            : "neutral",
                        label: "overdue delta",
                      }
                    : undefined
                }
              />
            </div>
          )}
        </section>

        {/* Today's Task Lists Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {dateFilter === "today"
                  ? "Today's Task Lists"
                  : "Task Lists in Period"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {recentLists.length}
              </span>
            </div>

            <Link
              href="/admin/tasks"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              View all lists <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading && recentLists.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : recentLists.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-10 h-10 text-slate-400" />}
              title="No task lists for this period"
              description="Create a task checklist and share it directly to your students on WhatsApp."
              actionNode={
                <Link href="/admin/tasks/new">
                  <Button size="sm" variant="primary">
                    <Plus className="w-4 h-4 mr-1.5" /> Create Task List
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    onDelete={handleDeleteList}
                  />
              ))}
            </div>
          )}
        </section>

        {/* Per-Group Progress Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Group Performance
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {groupStats.length}
              </span>
            </div>

            <Link
              href="/admin/groups"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              Manage groups <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading && groupStats.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : groupStats.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10 text-slate-400" />}
              title="No groups found"
              description="Create student groups to organize tasks and track team submissions."
              actionNode={
                <Link href="/admin/groups/new">
                  <Button size="sm" variant="primary">
                    <Plus className="w-4 h-4 mr-1.5" /> Create Group
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupStats.map((grp) => (
                <Link
                  key={grp.id}
                  href={`/admin/groups/${grp.id}`}
                  className="group block"
                >
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                            {grp.name}
                          </h3>
                          {grp.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {grp.description}
                            </p>
                          )}
                        </div>

                        {/* Circular Progress Ring */}
                        <CircularProgress value={grp.completion_rate} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100 dark:border-slate-800 my-2">
                        <div>
                          <span className="text-[11px] text-slate-400 block">
                            Tasks in Period
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {grp.done}/{grp.created} done
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">
                            Link Activity
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {grp.members_opened}/{grp.members_total} viewed
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {grp.members_total} members
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Details <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
