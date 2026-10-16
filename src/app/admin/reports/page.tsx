"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/hooks/useSession";
import { cn, getDateRange, calendarDateInTimeZone } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type {
  ReportsData,
  ReportSummary,
  ReportCompletionTrend,
  ReportGroupStat,
  ReportMemberStat,
} from "@/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  Filter,
  Mail,
  RefreshCw,
  Search,
  Trophy,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Layers,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to load reports");
    return res.json().then((d) => d.data);
  });

type DatePreset = "today" | "week" | "month" | "quarter" | "custom";
type ActiveTab = "overview" | "groups" | "members";

export default function ReportsPage() {
  const { session } = useSession({ requireAuth: true });
  const { toast } = useToast();

  // Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [trendView, setTrendView] = useState<"count" | "rate">("count");
  const [memberSearch, setMemberSearch] = useState<string>("" );
  const [memberSortBy, setMemberSortBy] = useState<"score" | "completed" | "onTime">("score");

  // Custom Date Range
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Action modals & spinners
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [digestEmailInput, setDigestEmailInput] = useState("");
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const adminTz = session?.timezone || DEFAULT_TIMEZONE;

  // Calculate dates based on preset
  const { fromDate, toDate } = useMemo(() => {
    const today = calendarDateInTimeZone(new Date(), adminTz);
    if (datePreset === "custom") {
      return {
        fromDate: customFrom || today,
        toDate: customTo || today,
      };
    }
    if (datePreset === "week" || datePreset === "month" || datePreset === "today") {
      const range = getDateRange(datePreset, customFrom, customTo, adminTz);
      return { fromDate: range.from, toDate: range.to };
    }
    // Last 90 days (quarter preset)
    const [y, m, d] = today.split("-").map(Number);
    const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    noon.setUTCDate(noon.getUTCDate() - 89);
    return {
      fromDate: calendarDateInTimeZone(noon, adminTz),
      toDate: today,
    };
  }, [datePreset, customFrom, customTo, adminTz]);

  // SWR query params
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (selectedGroup !== "all") params.set("group_id", selectedGroup);
    return `/api/admin/reports?${params.toString()}`;
  }, [fromDate, toDate, selectedGroup]);

  const { data, error, isLoading, mutate } = useSWR<ReportsData>(apiUrl, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  const handleRecompute = async () => {
    try {
      setIsRecomputing(true);
      const res = await fetch("/api/admin/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromDate, to: toDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to recompute stats");

      toast.success(
        `Processed ${json.data?.daysProcessed || 0} days of historical activity.`,
        "Stats Pre-computed"
      );
      mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Recompute failed");
    } finally {
      setIsRecomputing(false);
    }
  };

  const handleSendDigest = async () => {
    if (!digestEmailInput.trim()) {
      toast.error("Please enter at least one recipient email address.");
      return;
    }

    try {
      setIsSendingDigest(true);
      const emails = digestEmailInput
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/reports/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: emails }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to send digest");

      toast.success(`Digest email sent to ${emails.join(", ")}`);
      setIsDigestModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error sending digest");
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const qs = new URLSearchParams({ from: fromDate, to: toDate });
      if (selectedGroup !== "all") qs.set("group_id", selectedGroup);
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
      a.download = `tasks-export-${fromDate}_${toDate}.csv`;
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

  const pdfExportUrl = `/api/admin/reports/pdf?from=${fromDate}&to=${toDate}${
    selectedGroup !== "all" ? `&group_id=${selectedGroup}` : ""
  }`;

  const filteredMembers = useMemo(() => {
    if (!data?.memberStats) return [];
    let list = [...data.memberStats];
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.group_name.toLowerCase().includes(q)
      );
    }
    if (memberSortBy === "score") {
      list.sort((a, b) => b.score - a.score || b.completed_count - a.completed_count);
    } else if (memberSortBy === "completed") {
      list.sort((a, b) => b.completed_count - a.completed_count || b.score - a.score);
    } else if (memberSortBy === "onTime") {
      list.sort((a, b) => b.on_time_rate - a.on_time_rate || b.score - a.score);
    }
    return list;
  }, [data?.memberStats, memberSearch, memberSortBy]);

  const summary = data?.summary || {
    totalTasks: 0,
    completedTasks: 0,
    verifiedTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    onTimeRate: 0,
    activeGroups: 0,
    activeMembers: 0,
    avgResponseMinutes: 0,
  };

  const avgSpeedLabel = useMemo(() => {
    if (!summary.avgResponseMinutes) return null;
    const hours = Math.floor(summary.avgResponseMinutes / 60);
    const mins = Math.round(summary.avgResponseMinutes % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, [summary.avgResponseMinutes]);

  return (
    <AdminLayout
      title="Reports"
      subtitle="Performance summaries and exportable reports"
      actions={
        <a
          href={pdfExportUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" variant="primary" className="gap-1.5 shadow-sm">
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </Button>
        </a>
      }
    >
      <div className="space-y-6 pb-16">
        {/* Filter Controls Row */}
        <div className="p-4 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Period:
            </span>
            {(
              [
                { id: "week", label: "Last 7 Days" },
                { id: "month", label: "Last 30 Days" },
                { id: "quarter", label: "Last 90 Days" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  datePreset === preset.id
                    ? "bg-[var(--color-primary)] text-white font-semibold shadow-xs"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {preset.label}
              </button>
            ))}

            {datePreset === "custom" && (
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border border-[var(--color-border-input)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
                <span className="text-xs text-[var(--color-text-tertiary)]">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border border-[var(--color-border-input)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>
            )}
          </div>

          {/* Group Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Group:
            </span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            >
              <option value="all">All Groups ({data?.groupStats?.length || 0})</option>
              {data?.groupStats?.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. Concise Summary Card (§12.9) */}
        <div className="p-4 sm:p-5 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-[var(--color-primary)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
              {summary.totalTasks} tasks assigned · {summary.completedTasks} completed ({summary.completionRate}%) · {summary.overdueTasks} overdue
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Across {summary.activeGroups} active group{summary.activeGroups !== 1 ? "s" : ""}
              {avgSpeedLabel ? ` · Avg response speed: ${avgSpeedLabel}` : ""}
              {" · "}{summary.verifiedTasks} verified by admin
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-status-verified)]">
              <CheckCircle2 className="w-4 h-4" />
              {summary.onTimeRate}% on-time
            </span>
          </div>
        </div>

        {/* Tabs for detailed view */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border-secondary)] pb-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
              activeTab === "overview"
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Completion Trend</span>
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
              activeTab === "groups"
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Group Comparison ({data?.groupStats?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5",
              activeTab === "members"
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Member Leaderboard ({data?.memberStats?.length || 0})</span>
          </button>
        </div>

        {/* TAB 1: COMPLETION TREND */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Completion Trend
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Daily task completion performance over time
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-1 rounded-lg">
                  <button
                    onClick={() => setTrendView("count")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                      trendView === "count"
                        ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-xs"
                        : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    Task Counts
                  </button>
                  <button
                    onClick={() => setTrendView("rate")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all",
                      trendView === "rate"
                        ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold shadow-xs"
                        : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    Rate %
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="py-10 text-center text-xs text-[var(--color-text-tertiary)]">
                  Loading trend data…
                </div>
              ) : !data?.completionTrends || data.completionTrends.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-xl bg-[var(--color-surface-sunken)] border border-dashed border-[var(--color-border-primary)]">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    No activity in this period
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Complete some task lists first, then return here for trends.
                  </p>
                </div>
              ) : (
              <div className="h-[280px] w-full pt-2">
                {trendView === "count" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.completionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-secondary)" opacity={0.6} />
                      <XAxis dataKey="label" stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface-raised)",
                          borderColor: "var(--color-border-primary)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--color-text-primary)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="created"
                        name="Tasks Created"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="#3b82f6"
                        fillOpacity={0.15}
                      />
                      <Area
                        type="monotone"
                        dataKey="done"
                        name="Completed"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        fill="var(--color-primary)"
                        fillOpacity={0.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.completionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-secondary)" opacity={0.6} />
                      <XAxis dataKey="label" stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} domain={[0, 100]} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface-raised)",
                          borderColor: "var(--color-border-primary)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--color-text-primary)",
                        }}
                        formatter={(val) => [`${val}%`, "Completion Rate"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="completionRate"
                        name="Completion Rate %"
                        stroke="var(--color-primary)"
                        strokeWidth={2.5}
                        dot={{ fill: "var(--color-primary)", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: GROUP COMPARISON (§12.9) */}
        {activeTab === "groups" && (
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Group Comparison
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Progress and task counts across all WhatsApp groups
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {data?.groupStats?.map((grp) => (
                <div
                  key={grp.group_id}
                  className="p-3.5 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-[var(--color-text-primary)]">
                        {grp.group_name}
                      </h4>
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">
                        {grp.member_count} members · {grp.completed_tasks} of {grp.total_tasks} tasks done
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-text-primary)]">
                      {grp.completion_rate}%
                    </span>
                  </div>

                  <ProgressBar
                    value={grp.completed_tasks}
                    max={Math.max(grp.total_tasks, 1)}
                    showLabel={false}
                    size="sm"
                    animateColor={true}
                  />
                </div>
              ))}

              {(!data?.groupStats || data.groupStats.length === 0) && (
                <p className="text-xs text-[var(--color-text-tertiary)] text-center py-6">
                  No group data available for this date range.
                </p>
              )}
            </div>
          </Card>
        )}

        {/* TAB 3: MEMBER LEADERBOARD (§12.9) */}
        {activeTab === "members" && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border-secondary)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search member or group…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
                <span className="text-[var(--color-text-secondary)] font-medium">Sort by:</span>
                <select
                  value={memberSortBy}
                  onChange={(e) => setMemberSortBy(e.target.value as any)}
                  className="px-2.5 py-1 rounded-md border border-[var(--color-border-input)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)] focus:outline-none"
                >
                  <option value="score">Score</option>
                  <option value="completed">Total Done</option>
                  <option value="onTime">On-Time %</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] font-semibold text-[11px] border-b border-[var(--color-border-secondary)]">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Member</th>
                    <th className="py-2.5 px-4">Group</th>
                    <th className="py-2.5 px-4 text-center">Done</th>
                    <th className="py-2.5 px-4 text-center">Verified</th>
                    <th className="py-2.5 px-4 text-center">On-Time</th>
                    <th className="py-2.5 px-4 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-secondary)]">
                  {filteredMembers.map((member, index) => (
                    <tr
                      key={member.member_id}
                      className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-center font-bold text-xs text-[var(--color-text-secondary)]">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[var(--color-text-primary)]">
                        {member.name}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--color-text-secondary)]">
                        {member.group_name}
                      </td>
                      <td className="py-2.5 px-4 text-center font-semibold text-[var(--color-primary-text)]">
                        {member.completed_count}
                      </td>
                      <td className="py-2.5 px-4 text-center text-[var(--color-text-secondary)]">
                        {member.verified_count}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={cn(
                          "font-semibold",
                          member.on_time_rate >= 80 ? "text-[var(--color-status-verified)]" : "text-[var(--color-text-secondary)]"
                        )}>
                          {member.on_time_rate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-[var(--color-text-primary)]">
                        {member.score} pts
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                        No members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Secondary Actions Row (Bottom - §12.9) */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-[var(--color-border-secondary)]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={exportingCsv}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {exportingCsv ? "Exporting…" : "Export CSV"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsDigestModalOpen(true)}
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Send Email Digest
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRecompute}
            disabled={isRecomputing}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRecomputing && "animate-spin")} />
            {isRecomputing ? "Recomputing…" : "Recompute Stats"}
          </Button>
        </div>

        {/* Modal: Send Email Digest */}
        <Modal
          isOpen={isDigestModalOpen}
          onClose={() => setIsDigestModalOpen(false)}
          title="Send Executive Performance Digest"
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Send an automated HTML performance digest email with completion KPIs, leaderboards, and overdue alerts.
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Recipient Email(s):
              </label>
              <input
                type="text"
                placeholder="professor@university.edu, team@school.edu"
                value={digestEmailInput}
                onChange={(e) => setDigestEmailInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                Separate multiple recipients with commas. Requires RESEND_API_KEY.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border-secondary)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDigestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSendDigest}
                disabled={isSendingDigest}
              >
                {isSendingDigest ? "Sending…" : "Dispatch Email Digest"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
