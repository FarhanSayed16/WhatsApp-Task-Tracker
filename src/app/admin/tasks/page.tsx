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
import { Plus, CheckSquare, Layers } from "lucide-react";

export default function TaskListsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [groupId, setGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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

  const taskLists = Array.isArray(response) ? response : response?.data || [];
  const total = response?.meta?.total || taskLists.length;

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
            title={search ? "No matching task lists" : "No task lists found"}
            description={
              search
                ? `No checklists found matching "${search}". Try adjusting your filters.`
                : activeTab === "all"
                ? "You haven't created any task lists yet. Click \"New Task List\" to create and dispatch your first checklist via WhatsApp."
                : `No task lists with status "${activeTab}".`
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
                : () => {
                    window.location.href = "/admin/tasks/new";
                  }
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
