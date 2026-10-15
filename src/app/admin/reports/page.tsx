"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
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
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  Filter,
  Layers,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

// Color palettes for sleek dark/light mode charts
const PIE_COLORS = ["#10b981", "#f59e0b", "#0ea5e9", "#ef4444"];

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to load reports");
    return res.json().then((d) => d.data);
  });

type DatePreset = "today" | "week" | "month" | "quarter" | "custom";
type ActiveTab = "overview" | "members" | "groups";

export default function ReportsPage() {
  const { session } = useSession({ requireAuth: true });
  const { toast } = useToast();

  // Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [trendView, setTrendView] = useState<"count" | "rate">("count");
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [memberSortBy, setMemberSortBy] = useState<"score" | "completed" | "onTime">("score");

  // Custom Date Range
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Action modals & spinners
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [digestEmailInput, setDigestEmailInput] = useState("");
  const [isSendingDigest, setIsSendingDigest] = useState(false);

  // Calculate dates based on preset
  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);

    if (datePreset === "today") {
      return { fromDate: to, toDate: to };
    }
    if (datePreset === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { fromDate: d.toISOString().slice(0, 10), toDate: to };
    }
    if (datePreset === "month") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return { fromDate: d.toISOString().slice(0, 10), toDate: to };
    }
    if (datePreset === "quarter") {
      const d = new Date();
      d.setDate(d.getDate() - 89);
      return { fromDate: d.toISOString().slice(0, 10), toDate: to };
    }
    return {
      fromDate: customFrom || to,
      toDate: customTo || to,
    };
  }, [datePreset, customFrom, customTo]);

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

  // Recompute daily stats trigger
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
        `Successfully processed ${json.data.daysProcessed} days of historical activity.`,
        "Stats Pre-computed"
      );
      mutate();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "An error occurred",
        "Recompute Failed"
      );
    } finally {
      setIsRecomputing(false);
    }
  };

  // Trigger test email digest
  const handleSendDigest = async () => {
    if (!digestEmailInput.trim()) {
      toast.error(
        "Please enter at least one recipient email address.",
        "Email Required"
      );
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

      toast.success(
        `Digest email successfully dispatched to ${emails.join(", ")}.`,
        "Digest Sent!"
      );
      setIsDigestModalOpen(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error sending digest",
        "Send Failed"
      );
    } finally {
      setIsSendingDigest(false);
    }
  };

  // Export URLs
  const csvExportUrl = `/api/admin/export?from=${fromDate}&to=${toDate}${
    selectedGroup !== "all" ? `&group_id=${selectedGroup}` : ""
  }`;
  const pdfExportUrl = `/api/admin/reports/pdf?from=${fromDate}&to=${toDate}${
    selectedGroup !== "all" ? `&group_id=${selectedGroup}` : ""
  }`;

  // Filtered members list
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

  const donutData = useMemo(() => {
    if (!data?.onTimeBreakdown) return [];
    const b = data.onTimeBreakdown;
    return [
      { name: "On-Time", value: b.onTime },
      { name: "Completed Late", value: b.late },
      { name: "Pending", value: b.pending },
      { name: "Overdue", value: b.overdue },
    ].filter((item) => item.value > 0);
  }, [data?.onTimeBreakdown]);

  return (
    <AdminLayout
      title="Analytics & Reports"
      subtitle="Group performance, completion trends, and exportable data"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Header with Title & Export Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Analytics &amp; Performance Reports
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visual completion trends, group metrics, member scorecards, and branded exportable summaries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRecompute}
              disabled={isRecomputing}
              title="Pre-compute daily stats for this range"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRecomputing && "animate-spin text-emerald-600")} />
              <span>{isRecomputing ? "Recomputing..." : "Recompute Stats"}</span>
            </button>

            <button
              onClick={() => setIsDigestModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm"
            >
              <Mail className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Email Digest</span>
            </button>

            <a
              href={csvExportUrl}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Export CSV</span>
            </a>

            <a
              href={pdfExportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-sm hover:shadow-emerald-500/20"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Date Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Range:
              </span>
              {(
                [
                  { id: "today", label: "Today" },
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
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                    datePreset === preset.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700/60"
                  )}
                >
                  {preset.label}
                </button>
              ))}

              {datePreset === "custom" && (
                <div className="flex items-center gap-1.5 ml-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Group Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Group:
              </span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 shadow-sm"
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
        </Card>

        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Tasks */}
          <Card className="p-4 relative overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Tasks
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {isLoading ? "..." : summary.totalTasks}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Across {summary.activeGroups} active group{summary.activeGroups !== 1 ? "s" : ""}
            </p>
          </Card>

          {/* Completion Rate */}
          <Card className="p-4 relative overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Completion Rate
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {isLoading ? "..." : `${summary.completionRate}%`}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.completedTasks} completed • {summary.verifiedTasks} verified
            </p>
          </Card>

          {/* On-Time Rate */}
          <Card className="p-4 relative overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                On-Time Rate
              </span>
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-teal-600 dark:text-teal-400">
              {isLoading ? "..." : `${summary.onTimeRate}%`}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.overdueTasks > 0 ? (
                <span className="text-rose-500 font-semibold">{summary.overdueTasks} overdue</span>
              ) : (
                "100% on schedule"
              )}
            </p>
          </Card>

          {/* Avg Response Time */}
          <Card className="p-4 relative overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Avg Response Speed
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {isLoading
                ? "..."
                : summary.avgResponseMinutes > 60
                ? `${Math.round(summary.avgResponseMinutes / 60)}h`
                : `${summary.avgResponseMinutes}m`}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.activeMembers} member{summary.activeMembers !== 1 ? "s" : ""} engaged
            </p>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-all",
              activeTab === "overview"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview &amp; Trends</span>
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-all",
              activeTab === "members"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <Trophy className="w-4 h-4" />
            <span>Member Leaderboard ({data?.memberStats?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={cn(
              "flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-all",
              activeTab === "groups"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <Layers className="w-4 h-4" />
            <span>Group Comparisons ({data?.groupStats?.length || 0})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & TRENDS */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* Completion Trends & Donut Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trends Line/Area Chart */}
              <Card className="p-6 lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Task Completion Trends
                    </h3>
                    <p className="text-xs text-slate-500">
                      Daily tasks created vs completed across all scheduled lists
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setTrendView("count")}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all",
                        trendView === "count"
                          ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Task Counts
                    </button>
                    <button
                      onClick={() => setTrendView("rate")}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all",
                        trendView === "rate"
                          ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Rate %
                    </button>
                  </div>
                </div>

                <div className="h-[280px] w-full pt-4">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      Loading chart data...
                    </div>
                  ) : !data?.completionTrends || data.completionTrends.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No task activity recorded in this period.
                    </div>
                  ) : trendView === "count" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.completionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "10px",
                            fontSize: "12px",
                            color: "#fff",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Area
                          type="monotone"
                          dataKey="created"
                          name="Tasks Created"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorCreated)"
                        />
                        <Area
                          type="monotone"
                          dataKey="done"
                          name="Completed"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorDone)"
                        />
                        <Area
                          type="monotone"
                          dataKey="overdue"
                          name="Overdue"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          fillOpacity={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.completionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "10px",
                            fontSize: "12px",
                            color: "#fff",
                          }}
                          formatter={(val) => [`${val}%`, "Completion Rate"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="completionRate"
                          name="Completion Rate %"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={{ fill: "#10b981", r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* On-Time vs Late Distribution Donut */}
              <Card className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    On-Time vs Late Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Distribution of completion punctuality
                  </p>
                </div>

                <div className="h-[210px] w-full flex items-center justify-center">
                  {donutData.length === 0 ? (
                    <div className="text-xs text-slate-400">No status data to display</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-400">
                      On-Time ({data?.onTimeBreakdown?.onTime || 0})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600 dark:text-slate-400">
                      Late ({data?.onTimeBreakdown?.late || 0})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-slate-600 dark:text-slate-400">
                      Pending ({data?.onTimeBreakdown?.pending || 0})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-600 dark:text-slate-400">
                      Overdue ({data?.onTimeBreakdown?.overdue || 0})
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Daily Activity Calendar Heatmap */}
            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    Activity Density Heatmap
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daily completion volume across the selected timeframe
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>Less</span>
                  <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800" />
                  <span className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-950" />
                  <span className="w-3 h-3 rounded bg-emerald-400 dark:bg-emerald-700" />
                  <span className="w-3 h-3 rounded bg-emerald-600 dark:bg-emerald-500" />
                  <span>More</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-1.5">
                {data?.heatmap?.map((day) => {
                  const intensityClass =
                    day.intensity === 0
                      ? "bg-slate-100 dark:bg-slate-800/80 border-slate-200/40 dark:border-slate-800"
                      : day.intensity === 1
                      ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800"
                      : day.intensity === 2
                      ? "bg-emerald-300 dark:bg-emerald-800 border-emerald-400"
                      : day.intensity === 3
                      ? "bg-emerald-500 dark:bg-emerald-600 text-white"
                      : "bg-emerald-700 dark:bg-emerald-500 text-white shadow-sm";

                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} tasks completed`}
                      className={cn(
                        "w-5 h-5 rounded-md border text-[9px] font-bold flex items-center justify-center transition-all cursor-pointer hover:scale-125",
                        intensityClass
                      )}
                    >
                      {day.count > 0 ? day.count : ""}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: MEMBER LEADERBOARD */}
        {activeTab === "members" && (
          <div className="space-y-4 animate-fade-in">
            {/* Search and Sort controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search member or group..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-slate-500 font-semibold">Sort by:</span>
                <select
                  value={memberSortBy}
                  onChange={(e) => setMemberSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none shadow-sm"
                >
                  <option value="score">Performance Score</option>
                  <option value="completed">Total Completed</option>
                  <option value="onTime">On-Time %</option>
                </select>
              </div>
            </div>

            {/* Leaderboard Table */}
            <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Rank</th>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Group</th>
                      <th className="py-3 px-4 text-center">Completed</th>
                      <th className="py-3 px-4 text-center">Verified</th>
                      <th className="py-3 px-4 text-center">On-Time %</th>
                      <th className="py-3 px-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMembers.map((member, index) => {
                      const medal =
                        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

                      return (
                        <tr
                          key={member.member_id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-center font-bold text-sm">
                            {medal}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {member.name}
                            {member.phone && (
                              <span className="block text-[10px] font-normal text-slate-400">
                                {member.phone}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                              {member.group_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {member.completed_count}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">
                            {member.verified_count}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={cn(
                                "font-bold",
                                member.on_time_rate >= 80
                                  ? "text-emerald-600"
                                  : member.on_time_rate >= 50
                                  ? "text-amber-600"
                                  : "text-rose-600"
                              )}
                            >
                              {member.on_time_rate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              {member.score} pts
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No members matched your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: GROUP COMPARISONS */}
        {activeTab === "groups" && (
          <div className="space-y-6 animate-fade-in">
            {/* Bar Chart comparing group rates */}
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Group Completion Rates
                </h3>
                <p className="text-xs text-slate-500">
                  Comparative completion percentage across groups
                </p>
              </div>

              <div className="h-[280px] w-full pt-4">
                {!data?.groupStats || data.groupStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No group data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.groupStats} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                      <XAxis dataKey="group_name" stroke="#94a3b8" fontSize={11} interval={0} angle={-25} textAnchor="end" />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "10px",
                          fontSize: "12px",
                          color: "#fff",
                        }}
                        formatter={(val) => [`${val}%`, "Completion Rate"]}
                      />
                      <Bar dataKey="completion_rate" name="Completion Rate %" radius={[6, 6, 0, 0]}>
                        {data.groupStats.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.completion_rate >= 80
                                ? "#10b981"
                                : entry.completion_rate >= 50
                                ? "#f59e0b"
                                : "#ef4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Group Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.groupStats?.map((grp) => (
                <Card key={grp.group_id} className="p-5 space-y-4 hover:border-emerald-500/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {grp.group_name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {grp.member_count} enrolled members
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-black px-2.5 py-1 rounded-full",
                        grp.completion_rate >= 80
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200"
                          : grp.completion_rate >= 50
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200"
                      )}
                    >
                      {grp.completion_rate}% Done
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Tasks</span>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{grp.total_tasks}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Done</span>
                      <div className="font-bold text-emerald-600">{grp.completed_tasks}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Overdue</span>
                      <div className={cn("font-bold", grp.overdue_tasks > 0 ? "text-rose-600" : "text-slate-400")}>
                        {grp.overdue_tasks}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Send Email Digest */}
        <Modal
          isOpen={isDigestModalOpen}
          onClose={() => setIsDigestModalOpen(false)}
          title="Send Executive Performance Digest"
          description="Send an automated HTML performance digest email with completion KPIs, leaderboards, and overdue alerts."
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recipient Email(s):
              </label>
              <input
                type="text"
                placeholder="professor@university.edu, team@school.edu"
                value={digestEmailInput}
                onChange={(e) => setDigestEmailInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Separate multiple recipients with commas. Requires RESEND_API_KEY to be configured.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                {isSendingDigest ? "Sending..." : "Dispatch Email Digest"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
