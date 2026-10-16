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
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Share2,
  Copy,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  ArrowLeft,
  ExternalLink,
  Eye,
  Check,
  RotateCcw,
  User,
  Bell,
} from "lucide-react";
import { ShareSheet } from "@/components/admin/ShareSheet";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";

interface TaskDetailResponse {
  task_list: {
    id: string;
    token: string;
    title: string;
    list_date: string;
    due_at?: string | null;
    status: "draft" | "active" | "completed" | "archived";
    group_name: string;
    total_items: number;
    completed_items: number;
    completion_rate: number;
    is_overdue: boolean;
    share_url: string;
    member_link: string;
  };
  group: {
    id: string;
    name: string;
    verify_required: boolean;
  };
  items: Array<{
    id: string;
    text: string;
    position: number;
    status: "pending" | "done" | "verified";
    priority: "low" | "normal" | "high" | "urgent";
    assigned_member_id?: string | null;
    due_at?: string | null;
    completed_at?: string | null;
    verified_at?: string | null;
  }>;
  completions: Array<{
    id: string;
    task_item_id: string;
    member_id?: string | null;
    status: string;
    completed_at: string;
    note?: string | null;
  }>;
  members: Array<{
    id: string;
    name: string;
    phone?: string | null;
    active?: boolean;
  }>;
  opens: Array<{
    id: number;
    member_id: string;
    opened_at: string;
    member?: { name: string };
  }>;
  share_logs: Array<{
    id: number;
    channel: string;
    shared_at: string;
  }>;
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const { data, isLoading, mutate } = useSWRFetch<TaskDetailResponse>(
    `/api/admin/task-lists/${id}`
  );

  // Modals & form state
  const [showEditList, setShowEditList] = useState(false);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [shareSheetMode, setShareSheetMode] = useState<"share" | "reminder" | null>(null);

  // Edit List Form State
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDue, setEditDue] = useState("");
  const [savingList, setSavingList] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  // Add Item Form State
  const [newItemText, setNewItemText] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  // Action loadings
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleOpenEditList = () => {
    if (!data?.task_list) return;
    setEditTitle(data.task_list.title);
    setEditDate(data.task_list.list_date);
    setEditDue(data.task_list.due_at ? data.task_list.due_at.slice(0, 16) : "");
    setShowEditList(true);
  };

  const handleSaveEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    try {
      setSavingList(true);
      const res = await fetch(`/api/admin/task-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          list_date: editDate,
          due_at: editDue ? new Date(editDue).toISOString() : null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to update list");
      }

      toast.success("Task list updated successfully");
      setShowEditList(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update list");
    } finally {
      setSavingList(false);
    }
  };

  const handleDeleteList = async () => {
    try {
      setDeletingList(true);
      const res = await fetch(`/api/admin/task-lists/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to archive task list");

      toast.success("Task list archived");
      router.push("/admin/tasks");
    } catch (err: any) {
      toast.error(err.message || "Failed to archive task list");
    } finally {
      setDeletingList(false);
      setShowDeleteList(false);
    }
  };

  const handleCopyLink = () => {
    if (!data?.task_list.member_link) return;
    navigator.clipboard.writeText(data.task_list.member_link);
    toast.success("Member checklist link copied to clipboard!");
  };

  const handleVerifyItem = async (itemId: string) => {
    try {
      setActionLoadingId(itemId);
      const res = await fetch(`/api/admin/items/${itemId}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to verify item");
      }
      toast.success("Item verified!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Verify failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteItem = async (itemId: string) => {
    try {
      setActionLoadingId(itemId);
      const res = await fetch(`/api/admin/items/${itemId}/complete`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to complete item");
      }
      toast.success("Item marked done!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete item");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUndoItem = async (itemId: string) => {
    try {
      setActionLoadingId(itemId);
      const res = await fetch(`/api/admin/items/${itemId}/undo`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to undo item");
      toast.info("Item reverted to pending");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Undo failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this task item?")) return;

    try {
      setActionLoadingId(itemId);
      const res = await fetch(`/api/admin/items/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete item");
      toast.info("Item deleted");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !data) return;

    try {
      setSavingItem(true);
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_list_id: id,
          text: newItemText.trim(),
          position: data.items.length,
          priority: newItemPriority,
          assigned_member_id: newItemAssignee || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json?.error?.message);
      toast.success("Item added!");
      setNewItemText("");
      setNewItemPriority("normal");
      setNewItemAssignee("");
      setShowAddItem(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to add item");
    } finally {
      setSavingItem(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Loading Task List…" subtitle="Fetching checklist data">
        <div className="space-y-6">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-64" />
        </div>
      </AdminLayout>
    );
  }

  if (!data?.task_list) {
    return (
      <AdminLayout title="Task List Not Found" subtitle="Could not locate checklist">
        <EmptyState
          title="Task List Not Found"
          description="The requested task list does not exist or has been deleted."
          actionLabel="← Back to Tasks"
          onAction={() => router.push("/admin/tasks")}
        />
      </AdminLayout>
    );
  }

  const { task_list, group, items, completions, members, opens, share_logs } = data;

  const getCompletionFor = (itemId: string) => {
    return completions.find((c) => c.task_item_id === itemId);
  };

  const getMemberName = (mId?: string | null) => {
    if (!mId) return "Professor";
    const m = members.find((item) => item.id === mId);
    return m ? m.name : "Member";
  };

  return (
    <AdminLayout
      title={task_list.title}
      subtitle={`Group: ${task_list.group_name} · Dispatched on ${formatDate(task_list.list_date)}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/tasks">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              <ArrowLeft className="w-4 h-4 mr-1" /> All Tasks
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
          </Button>
          <Button
            size="sm"
            variant="whatsapp"
            onClick={() => setShareSheetMode("share")}
          >
            <WhatsAppIcon className="w-3.5 h-3.5 mr-1" /> Share WA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareSheetMode("reminder")}
          >
            <Bell className="w-3.5 h-3.5 mr-1" /> Remind
          </Button>
          <Link href={`/admin/tasks/new?clone_from=${task_list.id}`}>
            <Button variant="outline" size="sm" title="Duplicate as new checklist">
              <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleOpenEditList}>
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteList(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Progress Card */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  task_list.status === "completed"
                    ? "verified"
                    : task_list.status === "active"
                    ? "done"
                    : "neutral"
                }
                className="text-xs capitalize"
              >
                {task_list.status}
              </Badge>
              {task_list.is_overdue && (
                <Badge variant="overdue" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                </Badge>
              )}
              {group.verify_required && (
                <Badge variant="verified" className="text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Verification Required
                </Badge>
              )}
            </div>

            <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(task_list.list_date)}
              </span>
              {task_list.due_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Due: {formatDate(task_list.due_at)}
                </span>
              )}
              <a
                href={task_list.member_link}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-primary-text)] hover:underline flex items-center gap-1 font-semibold"
              >
                Open Member Page <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <ProgressBar
            value={task_list.completion_rate}
            showLabel={true}
            size="md"
          />

          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] pt-1">
            <span>
              <strong>{task_list.completed_items}</strong> of{" "}
              <strong>{task_list.total_items}</strong> items completed
            </span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {task_list.completion_rate}% Completed
            </span>
          </div>
        </Card>

        {/* Task Items Management Card */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Task Items ({items.length})
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Confirm member ticks or mark items done directly
              </p>
            </div>

            <Button size="sm" onClick={() => setShowAddItem(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[var(--color-border-primary)] rounded-lg text-xs text-[var(--color-text-tertiary)]">
              No tasks in this list. Click &quot;Add Item&quot; to add one.
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item, index) => {
                const completion = getCompletionFor(item.id);
                const assigned = members.find((m) => m.id === item.assigned_member_id);
                const isItemLoading = actionLoadingId === item.id;

                const statusBadge = {
                  pending: <Badge variant="pending">Pending</Badge>,
                  done: <Badge variant="done">Done (Awaiting Verify)</Badge>,
                  verified: <Badge variant="verified">Verified</Badge>,
                }[item.status];

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      item.status === "verified"
                        ? "bg-[var(--color-primary-subtle)]/40 border-[var(--color-status-verified)]/30"
                        : item.status === "done"
                        ? "bg-[var(--color-surface-sunken)] border-[var(--color-status-done)]/30"
                        : "bg-[var(--color-surface)] border-[var(--color-border-primary)] shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded bg-[var(--color-surface-sunken)] font-bold flex items-center justify-center text-[10px] shrink-0 text-[var(--color-text-secondary)] mt-0.5">
                          {index + 1}
                        </span>

                        <div className="space-y-1 min-w-0 flex-1">
                          <p
                            className={`text-xs font-medium leading-relaxed ${
                              item.status === "verified"
                                ? "line-through text-[var(--color-text-tertiary)]"
                                : "text-[var(--color-text-primary)]"
                            }`}
                          >
                            {item.text}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-[var(--color-text-tertiary)]">
                            {statusBadge}

                            {item.priority !== "normal" && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                                {item.priority}
                              </span>
                            )}

                            {assigned && (
                              <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Assigned: {assigned.name}
                              </span>
                            )}

                            {completion && (
                              <span className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {getMemberName(completion.member_id)} ·{" "}
                                {formatRelativeTime(completion.completed_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons per item */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {item.status === "pending" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={isItemLoading}
                            onClick={() => handleCompleteItem(item.id)}
                            className="text-xs h-7 px-2"
                          >
                            <Check className="w-3 h-3 mr-1 text-[var(--color-primary)]" /> Mark Done
                          </Button>
                        )}

                        {item.status === "done" && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isItemLoading}
                            onClick={() => handleVerifyItem(item.id)}
                            className="text-xs h-7 px-2"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" /> Verify
                          </Button>
                        )}

                        {(item.status === "done" || item.status === "verified") && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={isItemLoading}
                            onClick={() => handleUndoItem(item.id)}
                            className="text-xs h-7 px-2"
                            title="Undo completion"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          loading={isItemLoading}
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-xs p-1 h-7 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Audit & Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Member Opens */}
          <Card className="p-4 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-[var(--color-border-secondary)] pb-2">
              <Eye className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                Member Opens ({opens.length})
              </h3>
            </div>
            {opens.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)] py-2 text-center">
                No member opens recorded yet.
              </p>
            ) : (
              <div className="space-y-1 max-h-44 overflow-y-auto text-xs">
                {opens.map((open) => (
                  <div
                    key={open.id}
                    className="flex items-center justify-between py-1 px-2 rounded bg-[var(--color-surface-sunken)]"
                  >
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {open.member?.name || "Member"}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      {formatRelativeTime(open.opened_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Share Log */}
          <Card className="p-4 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-[var(--color-border-secondary)] pb-2">
              <Share2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                Share Dispatch Log ({share_logs.length})
              </h3>
            </div>
            {share_logs.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)] py-2 text-center">
                No share events logged yet.
              </p>
            ) : (
              <div className="space-y-1 max-h-44 overflow-y-auto text-xs">
                {share_logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-1 px-2 rounded bg-[var(--color-surface-sunken)]"
                  >
                    <span className="font-semibold text-[var(--color-text-primary)] text-[11px] uppercase">
                      {log.channel.replace("_", " ")}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      {formatRelativeTime(log.shared_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit List Modal */}
      <Modal
        isOpen={showEditList}
        onClose={() => setShowEditList(false)}
        title="Edit Task List"
      >
        <form onSubmit={handleSaveEditList} className="space-y-4">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
          <Input
            type="date"
            label="List Date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            required
          />
          <Input
            type="datetime-local"
            label="Due Date/Time (Optional)"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border-secondary)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditList(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingList}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete List ConfirmDialog */}
      <ConfirmDialog
        isOpen={showDeleteList}
        onClose={() => setShowDeleteList(false)}
        onConfirm={handleDeleteList}
        title="Archive Task List"
        message={`Are you sure you want to archive "${task_list.title}"? Members will no longer be able to check off items.`}
        confirmText="Archive List"
        variant="danger"
        loading={deletingList}
      />

      {/* Add Item Modal */}
      <Modal
        isOpen={showAddItem}
        onClose={() => setShowAddItem(false)}
        title="Add Checklist Item"
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <Input
            label="Task Description"
            placeholder="e.g. Verify voltage regulator output"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                Priority
              </label>
              <select
                value={newItemPriority}
                onChange={(e) => setNewItemPriority(e.target.value as any)}
                className="w-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-input)] text-xs p-2 text-[var(--color-text-primary)]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {members.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  Assign To
                </label>
                <select
                  value={newItemAssignee}
                  onChange={(e) => setNewItemAssignee(e.target.value)}
                  className="w-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-input)] text-xs p-2 text-[var(--color-text-primary)]"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border-secondary)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddItem(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingItem}>
              Add Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Share & Reminder Sheet */}
      {shareSheetMode && (
        <ShareSheet
          isOpen={true}
          onClose={() => setShareSheetMode(null)}
          taskList={{
            id: task_list.id,
            token: task_list.token,
            title: task_list.title,
            group_name: task_list.group_name,
            list_date: task_list.list_date,
            due_at: task_list.due_at,
            member_link: task_list.member_link,
            total_items: task_list.total_items,
            completed_items: task_list.completed_items,
          }}
          items={items.map((it) => ({
            id: it.id,
            text: it.text,
            status: it.status,
            assigned_member_id: it.assigned_member_id,
          }))}
          members={members}
          initialMode={shareSheetMode}
          onShareLogged={() => mutate()}
        />
      )}
    </AdminLayout>
  );
}
