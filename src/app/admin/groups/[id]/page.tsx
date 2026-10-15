"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MemberRow } from "@/components/admin/MemberRow";
import { KpiCard } from "@/components/admin/KpiCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  Users,
  CheckSquare,
  ShieldCheck,
  Edit,
  Trash2,
  Plus,
  FileText,
  UserPlus,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface MemberItem {
  id: string;
  name: string;
  phone?: string | null;
  active: boolean;
  completions_count: number;
}

interface TaskListItem {
  id: string;
  token: string;
  title: string;
  list_date: string;
  due_at?: string | null;
  status: "draft" | "active" | "completed" | "archived";
  total_items: number;
  completed_items: number;
}

interface GroupDetailData {
  group: {
    id: string;
    name: string;
    description?: string | null;
    verify_required: boolean;
    sort_order: number;
    created_at: string;
  };
  members: MemberItem[];
  recent_task_lists: TaskListItem[];
  stats: {
    total_members: number;
    total_lists: number;
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
  };
}

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const { data, isLoading, mutate } = useSWRFetch<GroupDetailData>(
    `/api/admin/groups/${id}`
  );

  // Group edit modal state
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVerify, setEditVerify] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);

  // Delete group state
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Member modal states
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  const [showImportCsv, setShowImportCsv] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);

  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberPhone, setEditMemberPhone] = useState("");

  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Open Edit Group modal pre-filled
  const handleOpenEditGroup = () => {
    if (!data?.group) return;
    setEditName(data.group.name);
    setEditDesc(data.group.description || "");
    setEditVerify(data.group.verify_required);
    setShowEditGroup(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setSavingGroup(true);
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          verify_required: editVerify,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to update group");
      }
      toast.success("Group updated successfully!");
      setShowEditGroup(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update group");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      setDeletingGroup(true);
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to delete group");
      }
      toast.success("Group deleted successfully");
      router.push("/admin/groups");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete group");
    } finally {
      setDeletingGroup(false);
      setShowDeleteGroup(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    try {
      setSavingMember(true);
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: id,
          name: newMemberName.trim(),
          phone: newMemberPhone.trim() ? newMemberPhone.replace(/\D/g, "") : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to add member");
      }
      toast.success(`Member "${newMemberName.trim()}" added!`);
      setNewMemberName("");
      setNewMemberPhone("");
      setShowAddMember(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    } finally {
      setSavingMember(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;

    try {
      setImportingCsv(true);
      const res = await fetch("/api/admin/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: id,
          csv: csvContent,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "CSV import failed");
      }
      const { imported, skipped } = json.data;
      toast.success(`Imported ${imported} members (${skipped} skipped duplicates)`);
      setCsvContent("");
      setShowImportCsv(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "CSV import failed");
    } finally {
      setImportingCsv(false);
    }
  };

  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.info(`Member status set to ${!currentActive ? "Active" : "Inactive"}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    }
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editMemberName.trim()) return;

    try {
      setSavingMember(true);
      const res = await fetch(`/api/admin/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editMemberName.trim(),
          phone: editMemberPhone.trim() ? editMemberPhone.replace(/\D/g, "") : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to update member");
      }
      toast.success("Member updated!");
      setEditingMember(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMemberId) return;
    try {
      setDeletingMember(true);
      const res = await fetch(`/api/admin/members/${deletingMemberId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete member");
      toast.success("Member removed from group");
      setDeletingMemberId(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete member");
    } finally {
      setDeletingMember(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Loading Group..." subtitle="Fetching roster and task history">
        <div className="space-y-6">
          <Skeleton variant="card" className="h-32" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton variant="card" className="h-28" />
            <Skeleton variant="card" className="h-28" />
            <Skeleton variant="card" className="h-28" />
          </div>
          <Skeleton variant="card" className="h-64" />
        </div>
      </AdminLayout>
    );
  }

  if (!data?.group) {
    return (
      <AdminLayout title="Group Not Found" subtitle="Could not locate this group">
        <EmptyState
          title="Group Not Found"
          description="The requested group does not exist or may have been deleted."
          actionLabel="← Back to Groups"
          onAction={() => router.push("/admin/groups")}
        />
      </AdminLayout>
    );
  }

  const { group, members, recent_task_lists, stats } = data;

  return (
    <AdminLayout
      title={group.name}
      subtitle={group.description || "WhatsApp Group Roster & Activity"}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/groups">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              <ArrowLeft className="w-4 h-4 mr-1" /> Groups
            </Button>
          </Link>
          <Link href={`/admin/tasks/new?group_id=${group.id}`}>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Task List
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleOpenEditGroup}>
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteGroup(true)}
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Total Members"
            value={stats.total_members}
            icon={<Users className="w-5 h-5" />}
            color="emerald"
          />
          <KpiCard
            label="Task Lists"
            value={stats.total_lists}
            icon={<CheckSquare className="w-5 h-5" />}
            color="blue"
          />
          <KpiCard
            label="Completion Rate"
            value={`${stats.completion_rate}%`}
            icon={<ShieldCheck className="w-5 h-5" />}
            color={stats.completion_rate >= 80 ? "emerald" : "amber"}
          />
        </div>

        {/* Member Roster Section */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Group Members
                </h2>
                <Badge variant="verified" className="text-xs">
                  {members.length}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Students and assistants who check off tasks
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowImportCsv(true)}
              >
                <FileText className="w-3.5 h-3.5 mr-1" /> Import CSV
              </Button>
              <Button size="sm" onClick={() => setShowAddMember(true)}>
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Member
              </Button>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
              No members in this group yet. Click &quot;Add Member&quot; or &quot;Import CSV&quot; to populate your roster.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  phone={member.phone}
                  active={member.active}
                  completionsCount={member.completions_count}
                  onToggleActive={handleToggleActive}
                  onEdit={(mId) => {
                    const m = members.find((item) => item.id === mId);
                    if (m) {
                      setEditingMember(m);
                      setEditMemberName(m.name);
                      setEditMemberPhone(m.phone || "");
                    }
                  }}
                  onDelete={(mId) => setDeletingMemberId(mId)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Recent Task Lists Section */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Task Lists
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dispatches and checklists created for this group
              </p>
            </div>

            <Link href={`/admin/tasks/new?group_id=${group.id}`}>
              <Button size="sm" variant="outline">
                <Plus className="w-3.5 h-3.5 mr-1" /> New Task List
              </Button>
            </Link>
          </div>

          {recent_task_lists.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
              No task lists created for this group yet. Click &quot;New Task List&quot; to dispatch your first checklist via WhatsApp.
            </div>
          ) : (
            <div className="space-y-3">
              {recent_task_lists.map((taskList) => {
                const pct =
                  taskList.total_items > 0
                    ? Math.round((taskList.completed_items / taskList.total_items) * 100)
                    : 0;

                return (
                  <Link
                    key={taskList.id}
                    href={`/admin/tasks/${taskList.id}`}
                    className="block p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 bg-white/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white hover:text-emerald-600 transition-colors">
                          {taskList.title}
                        </span>
                        <Badge
                          variant={
                            taskList.status === "completed"
                              ? "verified"
                              : taskList.status === "active"
                              ? "done"
                              : "neutral"
                          }
                          className="text-[10px] uppercase"
                        >
                          {taskList.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(taskList.list_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {taskList.completed_items}/{taskList.total_items} items
                        </span>
                      </div>
                    </div>

                    <ProgressBar value={pct} size="sm" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ══ Modals ══ */}

      {/* Edit Group Modal */}
      <Modal
        isOpen={showEditGroup}
        onClose={() => setShowEditGroup(false)}
        title="Edit Group"
        description="Update group name, description, and verification rules."
      >
        <form onSubmit={handleSaveGroup} className="space-y-4">
          <Input
            label="Group Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm p-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
            <input
              type="checkbox"
              checked={editVerify}
              onChange={(e) => setEditVerify(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Require Professor Verification for completed items</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditGroup(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingGroup}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Group ConfirmDialog */}
      <ConfirmDialog
        isOpen={showDeleteGroup}
        onClose={() => setShowDeleteGroup(false)}
        onConfirm={handleDeleteGroup}
        title="Delete Group"
        message={`Are you sure you want to delete "${group.name}"? All associated member records and task lists will be archived.`}
        confirmText="Delete Group"
        variant="danger"
        loading={deletingGroup}
      />

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="Add Group Member"
        description="Add an individual student or assistant to this group roster."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="Member Name"
            placeholder="e.g. Rachel Adams"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. 9876543210 (10-15 digits)"
            value={newMemberPhone}
            onChange={(e) => setNewMemberPhone(e.target.value)}
            helperText="Used if you want to dispatch direct WhatsApp messages"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddMember(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingMember}>
              Add Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        title="Edit Member"
      >
        <form onSubmit={handleSaveEditMember} className="space-y-4">
          <Input
            label="Member Name"
            value={editMemberName}
            onChange={(e) => setEditMemberName(e.target.value)}
            required
          />

          <Input
            label="Phone Number"
            placeholder="10-15 digits"
            value={editMemberPhone}
            onChange={(e) => setEditMemberPhone(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMember(null)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingMember}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={showImportCsv}
        onClose={() => setShowImportCsv(false)}
        title="Import Members from CSV"
        description="Paste lines formatted as Name,Phone or simply Names."
      >
        <form onSubmit={handleImportCsv} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              CSV Text
            </label>
            <textarea
              rows={6}
              placeholder={`Alex Smith,9876543210\nSarah Jenkins,9876543211\nMichael Scott`}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs p-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowImportCsv(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={importingCsv}
              disabled={!csvContent.trim()}
            >
              Import Members
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Member ConfirmDialog */}
      <ConfirmDialog
        isOpen={!!deletingMemberId}
        onClose={() => setDeletingMemberId(null)}
        onConfirm={handleDeleteMember}
        title="Remove Member"
        message="Are you sure you want to remove this member from the group roster? Past task completions will remain in history."
        confirmText="Remove Member"
        variant="danger"
        loading={deletingMember}
      />
    </AdminLayout>
  );
}
