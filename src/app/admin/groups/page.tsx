"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { GroupCard } from "@/components/admin/GroupCard";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { Users, Plus, FolderPlus } from "lucide-react";

interface EnrichedGroup {
  id: string;
  name: string;
  description?: string | null;
  verify_required: boolean;
  member_count: number;
  active_task_list_count: number;
  completion_rate: number;
  last_activity_at?: string | null;
}

export default function GroupsListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const url = `/api/admin/groups?search=${encodeURIComponent(search)}&page=${page}&limit=20`;
  const { data: response, isLoading, mutate } = useSWRFetch<any>(url);

  const groups: EnrichedGroup[] = Array.isArray(response)
    ? response
    : response?.data || [];
  const total = response?.meta?.total || groups.length;

  return (
    <AdminLayout
      title="Groups"
      subtitle="Manage student batches, lab groups, and staff rosters"
      actions={
        <Link href="/admin/groups/new">
          <Button size="sm" className="shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New Group
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Controls: Search & Meta */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              placeholder="Search groups..."
              onDebouncedChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
            />
          </div>

          <div className="text-xs text-[var(--color-text-secondary)] font-medium self-end sm:self-center">
            {isLoading ? (
              <span>Loading groups...</span>
            ) : (
              <span>
                Showing <strong className="text-[var(--color-text-primary)]">{groups.length}</strong> of <strong className="text-[var(--color-text-primary)]">{total}</strong> groups
              </span>
            )}
          </div>
        </div>

        {/* Groups Grid / States */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="card" className="h-56" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<FolderPlus className="w-8 h-8" />}
            title={search ? "No matching groups" : "No groups yet"}
            description={
              search
                ? `No groups found matching "${search}". Try a different keyword.`
                : "Create your first WhatsApp group to organize your students or lab members and start assigning tasks."
            }
            actionLabel={search ? "Clear Search" : "+ Create Your First Group"}
            onAction={
              search
                ? () => setSearch("")
                : () => {
                    window.location.href = "/admin/groups/new";
                  }
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                id={group.id}
                name={group.name}
                description={group.description}
                memberCount={group.member_count}
                activeTaskListCount={group.active_task_list_count}
                completionRate={group.completion_rate}
                lastActivityAt={group.last_activity_at}
                verifyRequired={group.verify_required}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
