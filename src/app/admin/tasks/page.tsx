"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TaskListCard } from "@/components/admin/TaskListCard";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import { Plus, CheckSquare, ClipboardList, Share2, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TaskListsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [groupId, setGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "due" | "progress">("newest");

  // Fetch groups for filter dropdown
  const { data: groupsData } = useSWRFetch<any>("/api/admin/groups?limit=100");
  const groups = Array.isArray(groupsData) ? groupsData : groupsData?.data || [];

  // Build query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "24",
  });
  if (activeTab !== "all") queryParams.set("status", activeTab);
  if (groupId) queryParams.set("group_id", groupId);
  if (search) queryParams.set("search", search);

  const { data: response, isLoading, mutate } = useSWRFetch<any>(
    `/api/admin/task-lists?${queryParams.toString()}`
  );

  const rawLists = Array.isArray(response) ? response : response?.data || [];
  const total = response?.meta?.total || rawLists.length;

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
    // newest: list_date then created
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
    <AdminLayout
      title="Task Lists"
      subtitle="Track, share, and monitor WhatsApp group checklists"
      actions={
        <Link href="/admin/tasks/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New Task List
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tab) => {
              setActiveTab(tab);
              setPage(1);
            }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-56">
              <SearchInput
                placeholder="Search lists..."
                onDebouncedChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
              />
            </div>

            {groups.length > 0 && (
              <select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-input)] text-xs px-3 py-2 text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-primary-subtle)]"
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
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-input)] text-xs px-3 py-2 text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)]"
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
                  Showing <strong className="text-[var(--color-text-primary)]">{taskLists.length}</strong> of <strong className="text-[var(--color-text-primary)]">{total}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Task Lists Grid */}
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
                ? () => setSearch("")
                : activeTab !== "all"
                ? () => setActiveTab("all")
                : () => router.push("/admin/tasks/new")
            }
          />
        ) : (
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
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
