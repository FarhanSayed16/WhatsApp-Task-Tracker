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
    active: boolean;
  }>;
  share_logs: Array<{
    id: string;
    channel: string;
    shared_at: string;
  }>;
  opens: Array<{
    id: string;
    member_id: string;
    opened_at: string;
    member?: { id: string; name: string };
  }>;
}

export default function TaskListDetailPage({
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

  // Modals state
  const [showEditList, setShowEditList] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDue, setEditDue] = useState("");
  const [savingList, setSavingList] = useState(false);

  const [showDeleteList, setShowDeleteList] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [shareSheetMode, setShareSheetMode] = useState<"share" | "reminder" | null>(null);

  const handleOpenEditList = () => {
    if (!data?.task_list) return;
    setEditTitle(data.task_list.title);
    setEditDate(data.task_list.list_date);
    setEditDue(data.task_list.due_at || "");
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
          due_at: editDue || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json?.error?.message);
      toast.success("Task list updated!");
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
      if (!res.ok) throw new Error("Failed to delete list");
      toast.success("Task list archived");
      router.push("/admin/tasks");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete list");
    } finally {
      setDeletingList(false);
      setShowDeleteList(false);
    }
  };

  const handleCopyLink = async () => {
    if (!data?.task_list) return;
    try {
      await navigator.clipboard.writeText(data.task_list.member_link);
      toast.success("Member checklist link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShareWa = () => {
    if (!data?.task_list?.share_url) return;
    window.open(data.task_list.share_url, "_blank");
  };

  // Item Action Handlers
  const handleCompleteItem = async (itemId: string) => {
    try {
      setActionLoadingId(itemId);
      const res = await fetch(`/api/admin/items/${itemId}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark item done");
      toast.success("Item marked verified!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleVerifyItem = async (itemId: string) => {
    try {
      setActionLoadingId(itemId);
      const res = await fetch(`/api/admin/items/${itemId}/verify`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to verify item");
      toast.success("Member tick verified!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
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
      <AdminLayout title="Loading Task List..." subtitle="Fetching checklist data">
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
            onClick={() => setShareSheetMode("share")}
            className="bg-[#25D366] hover:bg-[#20ba5a] text-white"
          >
            <Share2 className="w-3.5 h-3.5 mr-1" /> Share WA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareSheetMode("reminder")}
            className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <Bell className="w-3.5 h-3.5 mr-1" /> Remind
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenEditList}>
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteList(true)}
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Progress Card */}
        <Card className="p-6 space-y-4">
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
                className="text-xs uppercase"
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

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
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
                className="text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
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

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>
              <strong>{task_list.completed_items}</strong> of{" "}
              <strong>{task_list.total_items}</strong> items completed
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {task_list.completion_rate}% Completed
            </span>
          </div>
        </Card>

        {/* Task Items Management Card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Task Items ({items.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click controls to verify member ticks or mark completed directly
              </p>
            </div>

            <Button size="sm" onClick={() => setShowAddItem(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
              No tasks in this list. Click &quot;Add Item&quot; to add one.
            </div>
          ) : (
            <div className="space-y-3">
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
                    className={`p-4 rounded-xl border transition-all ${
                      item.status === "verified"
                        ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20"
                        : item.status === "done"
                        ? "bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-xs shrink-0 text-slate-500 mt-0.5">
                          {index + 1}
                        </span>

                        <div className="space-y-1 min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium leading-relaxed ${
                              item.status === "verified"
                                ? "line-through text-slate-400 dark:text-slate-500"
                                : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {item.text}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {statusBadge}

                            {item.priority !== "normal" && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                                {item.priority}
                              </span>
                            )}

                            {assigned && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Assigned: {assigned.name}
                              </span>
                            )}

                            {completion && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {getMemberName(completion.member_id)} ·{" "}
                                {formatRelativeTime(completion.completed_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Professor Action Buttons per item */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {item.status === "pending" && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isItemLoading}
                            onClick={() => handleCompleteItem(item.id)}
                            className="text-xs py-1 px-2.5 h-8"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Mark Done
                          </Button>
                        )}

                        {item.status === "done" && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isItemLoading}
                            onClick={() => handleVerifyItem(item.id)}
                            className="text-xs py-1 px-2.5 h-8 bg-emerald-600 hover:bg-emerald-500"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify
                          </Button>
                        )}

                        {(item.status === "done" || item.status === "verified") && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={isItemLoading}
                            onClick={() => handleUndoItem(item.id)}
                            className="text-xs py-1 px-2.5 h-8 text-slate-500 hover:text-slate-800"
                            title="Undo completion"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          loading={isItemLoading}
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-xs p-1.5 h-8 text-slate-400 hover:text-rose-500"
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

        {/* Audit & Activity: Opens & Shares */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Opens Audit */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Eye className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Member Opens ({opens.length})
              </h3>
            </div>
            {opens.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No member opens recorded yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                {opens.map((open) => (
                  <div
                    key={open.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {open.member?.name || "Member"}
                    </span>
                    <span className="text-slate-400">
                      {formatRelativeTime(open.opened_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Share Log */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Share2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Share Dispatch Log ({share_logs.length})
              </h3>
            </div>
            {share_logs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No share events logged yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                {share_logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                      {log.channel.replace("_", " ")}
                    </span>
                    <span className="text-slate-400">
                      {formatRelativeTime(log.shared_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ══ Modals ══ */}

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
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditList(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingList}>
              Save
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={newItemPriority}
                onChange={(e) => setNewItemPriority(e.target.value as any)}
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs p-2.5"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {members.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Assign To
                </label>
                <select
                  value={newItemAssignee}
                  onChange={(e) => setNewItemAssignee(e.target.value)}
                  className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs p-2.5"
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

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddItem(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingItem}>
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
