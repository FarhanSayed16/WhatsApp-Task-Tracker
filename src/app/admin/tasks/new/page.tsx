"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DatePicker";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Share2,
  FileText,
  AlertTriangle,
  User,
  ListPlus,
  Send,
  Repeat,
  CheckCircle2,
} from "lucide-react";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ShareSheet } from "@/components/admin/ShareSheet";
import { zonedDateTimeToUtcIso, cn } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { useSession } from "@/hooks/useSession";

interface ItemDraft {
  id: string;
  text: string;
  priority: "low" | "normal" | "high" | "urgent";
  assigned_member_id?: string | null;
}

export default function NewTaskPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout title="Create Task List" subtitle="Loading form...">
          <div className="max-w-3xl mx-auto space-y-6">
            <Skeleton variant="card" className="h-48" />
            <Skeleton variant="card" className="h-64" />
          </div>
        </AdminLayout>
      }
    >
      <NewTaskForm />
    </Suspense>
  );
}

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGroupId = searchParams.get("group_id") || "";
  const cloneFromId = searchParams.get("clone_from");
  const templateId = searchParams.get("template_id");
  const { toast } = useToast();
  const { session } = useSession();

  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState(preselectedGroupId);
  const [listDate, setListDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [showMultiPaste, setShowMultiPaste] = useState(false);
  const [multiPasteText, setMultiPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // Recurrence Schedule State (Phase 12.5)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<"daily" | "weekly">("daily");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const [createdList, setCreatedList] = useState<{
    id: string;
    token: string;
    title: string;
    group_name: string;
    list_date: string;
    due_at?: string | null;
    member_link?: string;
    items: Array<{ id: string; text: string; status: string }>;
    members: Array<{ id: string; name: string; phone?: string | null; active: boolean }>;
  } | null>(null);

  // Fetch groups
  const { data: groupsData } = useSWRFetch<any>("/api/admin/groups?limit=100");
  const groups = Array.isArray(groupsData) ? groupsData : groupsData?.data || [];

  // Prefer last-used group from localStorage, else first group
  useEffect(() => {
    if (groupId) return;
    if (groups.length === 0) return;
    const last =
      typeof window !== "undefined"
        ? localStorage.getItem("wtt_last_group_id")
        : null;
    const match = last && groups.find((g: { id: string }) => g.id === last);
    setGroupId(match ? match.id : groups[0].id);
  }, [groupId, groups]);

  // Load template if template_id in URL (Phase 12.2)
  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/admin/templates/${templateId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          const t = res.data;
          setTitle((prev) => prev || t.name);
          if (t.body?.items && t.body.items.length > 0) {
            const drafts: ItemDraft[] = t.body.items.map((itemText: string, idx: number) => ({
              id: `${Date.now()}-${idx}`,
              text: itemText,
              priority: "normal",
              assigned_member_id: null,
            }));
            setItems(drafts);
            toast.success(`Loaded ${drafts.length} items from template "${t.name}"`);
          }
        }
      })
      .catch((err) => console.error("Error loading template:", err));
  }, [templateId]);

  // Clone from existing task list if clone_from in URL (Phase 12.3)
  useEffect(() => {
    if (!cloneFromId) return;
    fetch(`/api/admin/task-lists/${cloneFromId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          const list = res.data.task_list;
          const taskItems = res.data.items || [];
          setTitle((prev) => prev || `${list.title} (Copy)`);
          if (list.group_id) setGroupId(list.group_id);
          if (taskItems.length > 0) {
            const drafts: ItemDraft[] = taskItems.map((item: any, idx: number) => ({
              id: `${Date.now()}-${idx}`,
              text: item.text,
              priority: item.priority || "normal",
              assigned_member_id: item.assigned_member_id || null,
            }));
            setItems(drafts);
            toast.success(`Cloned ${drafts.length} items from "${list.title}"`);
          }
        }
      })
      .catch((err) => console.error("Error cloning task list:", err));
  }, [cloneFromId]);

  // Fetch members for currently selected group
  const { data: membersData } = useSWRFetch<any>(
    groupId ? `/api/admin/members?group_id=${groupId}` : null
  );
  const members = Array.isArray(membersData) ? membersData : membersData?.data || [];

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newItemText.trim();
    if (!text) return;

    if (items.length >= 50) {
      toast.error("Maximum limit of 50 items reached");
      return;
    }

    const newItem: ItemDraft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      priority: newItemPriority,
      assigned_member_id: newItemAssignee || null,
    };

    setItems([...items, newItem]);
    setNewItemText("");
    setNewItemPriority("normal");
    setNewItemAssignee("");
  };

  const handleRemoveItem = (idToRemove: string) => {
    setItems(items.filter((item) => item.id !== idToRemove));
  };

  const handleProcessMultiPaste = () => {
    if (!multiPasteText.trim()) return;

    const lines = multiPasteText
      .split(/\r?\n/)
      .map((line) => {
        // Strip common bullet points and numbering: e.g. "1. ", "1) ", "- ", "* ", "• "
        return line.replace(/^(\d+[\.\)]|[-*•])\s*/, "").trim();
      })
      .filter(Boolean);

    const availableSlots = 50 - items.length;
    const linesToAdd = lines.slice(0, availableSlots);

    const newDrafts: ItemDraft[] = linesToAdd.map((text) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      priority: "normal",
      assigned_member_id: null,
    }));

    setItems([...items, ...newDrafts]);
    setMultiPasteText("");
    setShowMultiPaste(false);
    toast.success(`Added ${newDrafts.length} items`);
  };

  const handleSave = async (isShare: boolean) => {
    setErrors({});

    if (!title.trim()) {
      setErrors({ title: "Title is required" });
      return;
    }
    if (!groupId) {
      setErrors({ group: "Please select a group" });
      return;
    }
    if (items.length === 0) {
      setErrors({ items: "Please add at least one task item" });
      return;
    }

    // Prepare due_at in admin timezone (not raw Zulu)
    let dueAt: string | null = null;
    if (dueTime) {
      dueAt = zonedDateTimeToUtcIso(
        listDate,
        dueTime,
        session?.timezone || DEFAULT_TIMEZONE
      );
    }

    try {
      setLoading(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("wtt_last_group_id", groupId);
      }

        const recurrencePayload = isRecurring
          ? {
              freq: recurrenceFreq,
              days: recurrenceFreq === "weekly" ? recurrenceDays : undefined,
              end_date: recurrenceEndDate || undefined,
            }
          : null;

        const res = await fetch("/api/admin/task-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_id: groupId,
            title: title.trim(),
            list_date: listDate,
            due_at: dueAt,
            status: isShare ? "active" : "draft",
            recurrence: recurrencePayload,
            items: items.map((i) => ({
              text: i.text,
              priority: i.priority,
              assigned_member_id: i.assigned_member_id || null,
            })),
          }),
        });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to create task list");
      }

      toast.success(
        isShare ? "Task list created — open Share sheet to send" : "Task list saved as draft!"
      );

      if (isShare) {
        const listId = json.data.id;
        const detailRes = await fetch(`/api/admin/task-lists/${listId}`);
        const detailJson = await detailRes.json();
        const detail = detailJson.data;
        if (detail?.task_list) {
          setCreatedList({
            id: detail.task_list.id,
            token: detail.task_list.token,
            title: detail.task_list.title,
            group_name: detail.task_list.group_name,
            list_date: detail.task_list.list_date,
            due_at: detail.task_list.due_at,
            member_link: detail.task_list.member_link,
            items: detail.items || [],
            members: detail.members || [],
          });
          setShareSheetOpen(true);
        } else {
          router.push(`/admin/tasks/${listId}`);
        }
      } else {
        router.push(`/admin/tasks/${json.data.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save task list");
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Create Task List"
      subtitle="Compose task items and dispatch to group members"
      actions={
        <Link href="/admin/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Tasks
          </Button>
        </Link>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* List Info Card */}
        <Card className="p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            1. Task List Details
          </h2>

          <Input
            label="Task List Title"
            placeholder="e.g. Lab 4 Assignment: Sensor Calibration & Data Logging"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Dropdown
              label="Group"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              error={errors.group}
              placeholder="Select a group"
              options={groups.map((g: any) => ({
                value: g.id,
                label: g.name,
              }))}
            />

            <DatePicker
              label="List Date"
              value={listDate}
              onChange={setListDate}
              showQuickPicks={true}
            />

            <Input
              type="time"
              label="Due Time (Optional)"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </Card>

        {/* Checklist Items Card */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                2. Checklist Items ({items.length}/50)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks for members to check off on their mobile link
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMultiPaste(!showMultiPaste)}
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              {showMultiPaste ? "Single Input" : "Paste Multi-line"}
            </Button>
          </div>

          {errors.items && (
            <p className="text-xs text-rose-500 font-semibold">{errors.items}</p>
          )}

          {/* Multi-line Paste Mode */}
          {showMultiPaste ? (
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 animate-slide-up">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paste task list (one task per line, numbers/bullets automatically cleaned):
              </label>
              <textarea
                rows={5}
                placeholder={`1. Calibrate photodiode sensor\n2. Run 10 baseline samples\n3. Record temperature readings\n4. Submit data spreadsheet`}
                value={multiPasteText}
                onChange={(e) => setMultiPasteText(e.target.value)}
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs p-3 font-mono focus:outline-none focus:border-emerald-500 resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMultiPaste(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleProcessMultiPaste}
                  disabled={!multiPasteText.trim()}
                >
                  <ListPlus className="w-4 h-4 mr-1" /> Parse &amp; Add Items
                </Button>
              </div>
            </div>
          ) : (
            /* Single Item Input */
            <form onSubmit={handleAddItem} className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter task text... (Press Enter to add)"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                  />
                </div>
                <Button type="submit" size="md">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                {/* Priority Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Priority:</span>
                  {(["low", "normal", "high", "urgent"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewItemPriority(p)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors uppercase ${
                        newItemPriority === p
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Optional Member Assignee */}
                {members.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={newItemAssignee}
                      onChange={(e) => setNewItemAssignee(e.target.value)}
                      className="bg-transparent border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1 px-2 text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                      <option value="">Unassigned (Any member)</option>
                      {members.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          Assign: {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Current Items List */}
          {items.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
              No tasks added yet. Type a task above and press Enter, or use &quot;Paste Multi-line&quot;.
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {items.map((item, index) => {
                const assigned = members.find((m: any) => m.id === item.assigned_member_id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.text}
                      </span>
                      {item.priority !== "normal" && (
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            item.priority === "urgent" || item.priority === "high"
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600"
                          }`}
                        >
                          {item.priority}
                        </span>
                      )}
                      {assigned && (
                        <span className="text-[11px] text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.2 rounded">
                          @{assigned.name}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {items.length >= 45 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Approaching maximum recommended 50 items per list ({items.length}/50).</span>
            </div>
          )}
        </Card>

        {errors.form && (
          <p className="text-xs text-rose-500 font-semibold">{errors.form}</p>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Link href="/admin/tasks">
            <Button type="button" variant="ghost" disabled={loading}>
              Cancel
            </Button>
          </Link>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => handleSave(false)}
              className="flex-1 sm:flex-initial"
            >
              Save as Draft
            </Button>

            <Button
              type="button"
              variant="primary"
              loading={loading}
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-initial bg-[#25D366] hover:bg-[#20ba5a] text-white"
            >
              <Send className="w-4 h-4 mr-1.5" /> Save &amp; Share
            </Button>
          </div>
        </div>
      </div>

      {createdList && (
        <ShareSheet
          isOpen={shareSheetOpen}
          onClose={() => {
            setShareSheetOpen(false);
            router.push(`/admin/tasks/${createdList.id}`);
          }}
          taskList={{
            id: createdList.id,
            token: createdList.token,
            title: createdList.title,
            group_name: createdList.group_name,
            list_date: createdList.list_date,
            due_at: createdList.due_at,
            member_link: createdList.member_link,
            total_items: createdList.items.length,
            completed_items: 0,
          }}
          items={createdList.items}
          members={createdList.members}
          onShareLogged={() => {
            toast.success("Share logged");
          }}
        />
      )}
    </AdminLayout>
  );
}
