"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TaskListCard } from "@/components/admin/TaskListCard";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import {
  Plus,
  CheckSquare,
  ClipboardList,
  Share2,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type SortKey = "newest" | "due" | "progress";

type TaskListsPayload = {
  lists: any[];
  meta: { page?: number; limit?: number; total?: number; totalPages?: number };
};

async function fetchTaskLists(url: string): Promise<TaskListsPayload> {
  const res = await fetch(url, { credentials: "same-origin" });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || "Failed to load task lists");
  }
  return {
    lists: Array.isArray(json.data) ? json.data : [],
    meta: json.meta || { total: 0, page: 1, totalPages: 1 },
  };
}

export default function TaskListsPage() {
  return (
    <AdminLayout
      title="Task Lists"
      subtitle="Track, share, and monitor WhatsApp group checklists"
      actions={
        <Link href="/admin/tasks/new" title="New Task List (N)">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New Task List
          </Button>
        </Link>
      }
    >
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="card" className="h-60" />
            ))}
          </div>
        }
      >
        <TaskListsContent />
      </Suspense>
    </AdminLayout>
  );
}

function TaskListsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const activeTab = searchParams.get("status") || "all";
  const groupId = searchParams.get("group") || "";
  const search = searchParams.get("q") || "";
  const sortBy = (searchParams.get("sort") as SortKey) || "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const updateParams = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      const skip =
        value === undefined ||
        value === "" ||
        (key === "status" && value === "all") ||
        (key === "sort" && value === "newest") ||
        (key === "page" && Number(value) === 1);
      if (skip) next.delete(key);
      else next.set(key, String(value));
    }
    const qs = next.toString();
    router.replace(qs ? `/admin/tasks?${qs}` : "/admin/tasks", { scroll: false });
  };

  const { data: groupsData } = useSWRFetch<any>("/api/admin/groups?limit=100");
  const groups = Array.isArray(groupsData) ? groupsData : groupsData?.data || [];

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "24",
  });
  if (activeTab !== "all") queryParams.set("status", activeTab);
  if (groupId) queryParams.set("group_id", groupId);
  if (search) queryParams.set("search", search);

  const { data: payload, isLoading, mutate } = useSWR(
    `/api/admin/task-lists?${queryParams.toString()}`,
    fetchTaskLists,
    { revalidateOnFocus: true, dedupingInterval: 2000 }
  );

  const rawLists = payload?.lists || [];
  const total = payload?.meta?.total ?? rawLists.length;
  const totalPages = Math.max(1, payload?.meta?.totalPages || 1);

  const taskLists = [...rawLists].sort((a: any, b: any) => {
    if (sortBy === "due") {
      const ad = a.due_at || a.list_date || "";
      const bd = b.due_at || b.list_date || "";
      return ad.localeCompare(bd);
    }
    if (sortBy === "progress") {
      const ap = a.total_items > 0 ? a.completed_items / a.total_items : 0;
      const bp = b.total_items > 0 ? b.completed_items / b.total_items : 0;
      return bp - ap;
    }
    return String(b.list_date || "").localeCompare(String(a.list_date || ""));
  });

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/task-lists/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task list");
      toast.success("Task list archived");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task list");
    }
  };

  const tabs = [
    { id: "all", label: "All Lists" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "draft", label: "Drafts" },
    { id: "archived", label: "Archived" },
  ];

  return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] glass-card p-3 sm:p-3.5 space-y-3">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tab) => updateParams({ status: tab, page: 1 })}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-56">
              <SearchInput
                value={search}
                placeholder="Search lists..."
                onDebouncedChange={(val) => {
                  if (val === search) return;
                  updateParams({ q: val, page: 1 });
                }}
              />
            </div>

            {groups.length > 0 && (
              <select
                value={groupId}
                onChange={(e) => updateParams({ group: e.target.value, page: 1 })}
                className="field-control"
              >
                <option value="">All Groups</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => updateParams({ sort: e.target.value as SortKey })}
              className="field-control"
              aria-label="Sort lists"
            >
              <option value="newest">Newest first</option>
              <option value="due">Due date</option>
              <option value="progress">Progress</option>
            </select>

            <div className="text-xs text-[var(--color-text-secondary)] font-medium ml-auto hidden sm:block">
              {isLoading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  Showing{" "}
                  <strong className="text-[var(--color-text-primary)]">
                    {taskLists.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-[var(--color-text-primary)]">{total}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="card" className="h-60" />
            ))}
          </div>
        ) : taskLists.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="w-8 h-8" />}
            title={search ? "No matching task lists" : "No task lists yet"}
            description={
              search
                ? `No checklists found matching "${search}". Try adjusting your filters.`
                : activeTab === "all"
                ? "Create a checklist, share it to WhatsApp, and track completions here."
                : `No task lists with status "${activeTab}".`
            }
            steps={
              !search && activeTab === "all"
                ? [
                    {
                      icon: <ClipboardList className="w-4 h-4" />,
                      label: "Step 1 — Create",
                      description: "Build a checklist for a group",
                    },
                    {
                      icon: <Share2 className="w-4 h-4" />,
                      label: "Step 2 — Share",
                      description: "Send the wa.me link to WhatsApp",
                    },
                    {
                      icon: <ListChecks className="w-4 h-4" />,
                      label: "Step 3 — Track",
                      description: "Members tick items; you verify here",
                    },
                  ]
                : undefined
            }
            actionLabel={
              search
                ? "Clear Search"
                : activeTab !== "all"
                ? "Show All Lists"
                : "+ Create Task List"
            }
            onAction={
              search
                ? () => updateParams({ q: "", page: 1 })
                : activeTab !== "all"
                ? () => updateParams({ status: "all", page: 1 })
                : () => router.push("/admin/tasks/new")
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {taskLists.map((taskList: any) => (
                <TaskListCard
                  key={taskList.id}
                  id={taskList.id}
                  token={taskList.token}
                  title={taskList.title}
                  groupName={taskList.group_name}
                  listDate={taskList.list_date}
                  dueAt={taskList.due_at}
                  status={taskList.status}
                  totalItems={taskList.total_items}
                  completedItems={taskList.completed_items}
                  shareUrl={taskList.share_url}
                  recurrence={taskList.recurrence}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: page - 1 })}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: page + 1 })}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
  );
}
