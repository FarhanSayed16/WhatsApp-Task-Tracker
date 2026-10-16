"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { ShareSheet } from "@/components/admin/ShareSheet";
import { VoiceTaskInput } from "@/components/admin/VoiceTaskInput";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/ui/Toast";
import { zonedDateTimeToUtcIso, cn, parsePastedTasks } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type { ParsedAITaskItem } from "@/lib/ai";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  AlertTriangle,
  User,
  ListPlus,
  Send,
  Repeat,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";

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
        <AdminLayout title="Create Task List" subtitle="Loading form…">
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

  // Recurrence Schedule State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<"daily" | "weekly" | "custom">("daily");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(3);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);

  const [createdList, setCreatedList] = useState<{
    id: string;
    token: string;
    title: string;
    group_name: string;
    list_date: string;
    due_at?: string | null;
    member_link: string;
    items: any[];
    members: any[];
  } | null>(null);

  // Fetch groups for dropdown
  const { data: groupsData } = useSWRFetch<any>("/api/admin/groups?limit=100");
  const groups = Array.isArray(groupsData) ? groupsData : groupsData?.data || [];

  // Auto-select group if only 1 group exists
  useEffect(() => {
    if (!groupId && groups.length === 1) {
      setGroupId(groups[0].id);
    } else if (!groupId && typeof window !== "undefined") {
      const saved = localStorage.getItem("wtt_last_group_id");
      if (saved && groups.some((g: any) => g.id === saved)) {
        setGroupId(saved);
      }
    }
  }, [groups, groupId]);

  // Fetch members for selected group
  const { data: membersData } = useSWRFetch<any>(
    groupId ? `/api/admin/groups/${groupId}/members` : null
  );
  const members = Array.isArray(membersData) ? membersData : membersData?.data || [];

  // Load from template if provided
  const { data: templateData } = useSWRFetch<any>(
    templateId ? `/api/admin/templates/${templateId}` : null
  );

  useEffect(() => {
    if (templateData?.data) {
      const t = templateData.data;
      if (!title) setTitle(t.name);
      if (t.body?.items && Array.isArray(t.body.items) && items.length === 0) {
        setItems(
          t.body.items.map((text: string) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text,
            priority: "normal",
          }))
        );
      }
    }
  }, [templateData]);

  // Load from clone source if provided
  const { data: cloneData } = useSWRFetch<any>(
    cloneFromId ? `/api/admin/task-lists/${cloneFromId}` : null
  );

  useEffect(() => {
    if (cloneData?.data) {
      const { task_list, items: clonedItems } = cloneData.data;
      if (!title && task_list?.title) setTitle(`${task_list.title} (Copy)`);
      if (!groupId && task_list?.group_id) setGroupId(task_list.group_id);
      if (clonedItems && Array.isArray(clonedItems) && items.length === 0) {
        setItems(
          clonedItems.map((ci: any) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: ci.text,
            priority: ci.priority || "normal",
            assigned_member_id: ci.assigned_member_id || null,
          }))
        );
      }
    }
  }, [cloneData]);

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    if (items.length >= 50) {
      toast.error("Maximum 50 items allowed per task list.");
      return;
    }

    setItems([
      ...items,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        priority: newItemPriority,
        assigned_member_id: newItemAssignee || null,
      },
    ]);
    setNewItemText("");
    setErrors((prev) => ({ ...prev, items: "" }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleProcessMultiPaste = () => {
    if (!multiPasteText.trim()) return;
    const parsed = parsePastedTasks(multiPasteText);
    const availableSlots = 50 - items.length;
    const toAdd = parsed.slice(0, availableSlots).map((text) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      priority: "normal" as const,
      assigned_member_id: null,
    }));

    setItems([...items, ...toAdd]);
    setMultiPasteText("");
    setShowMultiPaste(false);
    toast.success(`Added ${toAdd.length} items from text`);
  };

  const handleAiParseText = async () => {
    if (!multiPasteText.trim()) return;
    try {
      setIsAiParsing(true);
      const res = await fetch("/api/admin/ai/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: multiPasteText }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "AI parsing failed");
      }

      const extracted: ParsedAITaskItem[] = json.data?.items || [];
      if (extracted.length === 0) {
        toast.info("No actionable tasks detected in text");
        return;
      }

      const availableSlots = 50 - items.length;
      const itemsToAdd = extracted.slice(0, availableSlots);
      const newDrafts: ItemDraft[] = itemsToAdd.map((it) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: it.suggested_category
          ? `[${it.suggested_category}] ${it.text}`
          : it.text,
        priority: it.suggested_priority || "normal",
        assigned_member_id: null,
      }));

      if (!dueTime) {
        const dueHint = itemsToAdd.find((it) => it.suggested_due)?.suggested_due;
        const clockMatch = dueHint?.match(/(\d{1,2}):(\d{2})/);
        if (clockMatch) {
          const hh = String(Math.min(23, Number(clockMatch[1]))).padStart(2, "0");
          setDueTime(`${hh}:${clockMatch[2]}`);
        }
      }

      setItems([...items, ...newDrafts]);
      setMultiPasteText("");
      setShowMultiPaste(false);
      toast.success(`Extracted & added ${newDrafts.length} tasks!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse with AI");
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleVoiceTasksExtracted = (voiceItems: ParsedAITaskItem[]) => {
    const availableSlots = 50 - items.length;
    const itemsToAdd = voiceItems.slice(0, availableSlots);
    const newDrafts: ItemDraft[] = itemsToAdd.map((it) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: it.suggested_category
        ? `[${it.suggested_category}] ${it.text}`
        : it.text,
      priority: it.suggested_priority || "normal",
      assigned_member_id: null,
    }));
    if (!dueTime) {
      const dueHint = itemsToAdd.find((it) => it.suggested_due)?.suggested_due;
      const clockMatch = dueHint?.match(/(\d{1,2}):(\d{2})/);
      if (clockMatch) {
        const hh = String(Math.min(23, Number(clockMatch[1]))).padStart(2, "0");
        setDueTime(`${hh}:${clockMatch[2]}`);
      }
    }
    setItems((prev) => [...prev, ...newDrafts]);
    toast.success(`Added ${newDrafts.length} task(s) from voice dictation!`);
  };

  const handleSave = async (isShare: boolean) => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!groupId) newErrors.group = "Please select a group";
    if (items.length === 0) newErrors.items = "Please add at least one task item";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

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
            interval_days:
              recurrenceFreq === "custom" ? recurrenceIntervalDays : undefined,
            anchor_date: recurrenceFreq === "custom" ? listDate : undefined,
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
        isShare ? "Task list created — opening Share sheet" : "Task list saved as draft!"
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

  const parsedLines = useMemo(() => {
    return multiPasteText
      .split(/\r?\n/)
      .map((line) => line.replace(/^(\d+[\.\)]|[-*•▫️])\s*/, "").trim())
      .filter(Boolean);
  }, [multiPasteText]);

  return (
    <AdminLayout
      title="Create Task List"
      subtitle="Compose checklist items and dispatch to group members"
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/templates">
            <Button variant="outline" size="sm">
              <FileText className="w-3.5 h-3.5 mr-1" /> Templates
            </Button>
          </Link>
          <Link href="/admin/tasks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Tasks
            </Button>
          </Link>
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Template / Clone Banner */}
        {(templateId || cloneFromId) && (
          <div className="p-3.5 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 text-xs text-[var(--color-primary-text)] flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />
              {templateId ? "Pre-filled from checklist template" : "Cloned from previous checklist"}
            </span>
            <span className="text-[11px] font-semibold">
              {items.length} items loaded
            </span>
          </div>
        )}

        {/* Section 1: Task List Details (§12.5) */}
        <Card className="p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-secondary)] pb-2.5">
            List Details
          </h2>

          <Input
            label="Task List Title"
            placeholder="e.g. Lab 4 Assignment: Sensor Calibration & Data Logging"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            required
          />

          {groups.length === 0 ? (
            <div className="p-4 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">No groups created yet</p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Task checklists belong to a student group. Please create a group first before composing lists.
              </p>
              <Link href="/admin/groups/new">
                <Button size="sm" variant="primary" className="gap-1.5 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Create your first group
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          )}
        </Card>

        {/* Recurrence Schedule Card */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] flex items-center justify-center">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                  Recurring Schedule
                </h3>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  Auto-create draft task lists on scheduled days
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--color-border-primary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>

          {isRecurring && (
            <div className="pt-3 border-t border-[var(--color-border-secondary)] space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Frequency:
                </span>
                {(["daily", "weekly", "custom"] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setRecurrenceFreq(freq)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-all capitalize",
                      recurrenceFreq === freq
                        ? "bg-[var(--color-primary)] text-white font-semibold"
                        : "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    {freq === "custom" ? "Every N days" : freq}
                  </button>
                ))}
              </div>

              {recurrenceFreq === "custom" && (
                <div className="flex items-center gap-2 max-w-xs text-xs">
                  <span className="text-[var(--color-text-secondary)]">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={recurrenceIntervalDays}
                    onChange={(e) =>
                      setRecurrenceIntervalDays(
                        Math.max(1, Math.min(90, Number(e.target.value) || 1))
                      )
                    }
                    className="w-16 px-2 py-1 rounded-md border border-[var(--color-border-input)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)]"
                  />
                  <span className="text-[var(--color-text-secondary)]">days</span>
                </div>
              )}

              {recurrenceFreq === "weekly" && (
                <div className="space-y-1.5">
                  <span className="text-xs text-[var(--color-text-secondary)]">Days of week:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 1, label: "M" },
                      { id: 2, label: "T" },
                      { id: 3, label: "W" },
                      { id: 4, label: "T" },
                      { id: 5, label: "F" },
                      { id: 6, label: "S" },
                      { id: 0, label: "S" },
                    ].map((day) => {
                      const active = recurrenceDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            if (active) {
                              setRecurrenceDays(recurrenceDays.filter((d) => d !== day.id));
                            } else {
                              setRecurrenceDays([...recurrenceDays, day.id]);
                            }
                          }}
                          className={cn(
                            "w-7 h-7 rounded-md text-xs font-semibold transition-all",
                            active
                              ? "bg-[var(--color-primary)] text-white"
                              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]"
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="max-w-xs">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  End Repeat Date (Optional)
                </label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-[var(--color-border-input)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)]"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Section 2: Checklist Items (§12.5) */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Checklist Items ({items.length}/50)
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Actionable tasks for students to check off
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMultiPaste(!showMultiPaste)}
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              {showMultiPaste ? "Single Input" : "Paste Notes"}
            </Button>
          </div>

          {/* Voice-to-Tasks Dictation Component */}
          <VoiceTaskInput
            onTasksExtracted={handleVoiceTasksExtracted}
            className="pb-2 border-b border-[var(--color-border-secondary)]"
          />

          {errors.items && (
            <p className="text-xs text-[var(--color-danger)] font-semibold">{errors.items}</p>
          )}

          {/* Multi-line Paste Mode */}
          {showMultiPaste ? (
            <div className="space-y-3 p-4 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-primary)]">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                Paste checklist (numbered lines, bullets, or messy meeting notes):
              </label>
              <textarea
                rows={5}
                placeholder={`1. Calibrate photodiode sensor\n2. Run 10 baseline samples\n3. Record temperature readings\n4. Submit data spreadsheet`}
                value={multiPasteText}
                onChange={(e) => setMultiPasteText(e.target.value)}
                className="w-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-input)] text-xs p-3 font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
              />

              {parsedLines.length > 0 && (
                <div className="p-2.5 rounded-lg bg-[var(--color-primary-subtle)] text-xs">
                  <div className="flex items-center justify-between text-[var(--color-primary-text)] font-semibold mb-1">
                    <span>Parsed preview ({parsedLines.length} items):</span>
                    <span className="text-[10px]">
                      {Math.min(50 - items.length, parsedLines.length)} will be added
                    </span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    {parsedLines.slice(0, 4).map((l, i) => (
                      <div key={i} className="truncate">• {l}</div>
                    ))}
                    {parsedLines.length > 4 && (
                      <div className="text-[var(--color-text-tertiary)]">…and {parsedLines.length - 4} more</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMultiPaste(false)}
                >
                  Cancel
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleProcessMultiPaste}
                    disabled={!multiPasteText.trim() || isAiParsing}
                  >
                    <ListPlus className="w-3.5 h-3.5 mr-1" /> Plain Lines
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleAiParseText}
                    disabled={!multiPasteText.trim() || isAiParsing}
                  >
                    {isAiParsing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        AI Parsing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        AI Smart Parse
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Single Item Input */
            <form onSubmit={handleAddItem} className="space-y-2.5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter task item… (Press Enter to add)"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                  />
                </div>
                <Button type="submit" size="md">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Priority Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-tertiary)] font-medium">Priority:</span>
                  {(["low", "normal", "high", "urgent"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewItemPriority(p)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors capitalize",
                        newItemPriority === p
                          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] border border-[var(--color-primary)]/20 font-bold"
                          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Optional Assignee */}
                {members.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                    <select
                      value={newItemAssignee}
                      onChange={(e) => setNewItemAssignee(e.target.value)}
                      className="bg-transparent border border-[var(--color-border-input)] rounded-md text-xs py-0.5 px-2 text-[var(--color-text-primary)] focus:outline-none"
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
            <div className="p-6 text-center border border-dashed border-[var(--color-border-primary)] rounded-lg text-xs text-[var(--color-text-tertiary)]">
              No tasks added yet. Type a task above and press Enter, or use &quot;Paste Notes&quot;.
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              {items.map((item, index) => {
                const assigned = members.find((m: any) => m.id === item.assigned_member_id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)] text-xs gap-3 group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded bg-[var(--color-surface)] border border-[var(--color-border-primary)] font-bold flex items-center justify-center text-[10px] text-[var(--color-text-secondary)] shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-medium text-[var(--color-text-primary)] truncate">
                        {item.text}
                      </span>
                      {item.priority !== "normal" && (
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase px-1.5 py-0.2 rounded",
                            item.priority === "urgent" || item.priority === "high"
                              ? "bg-[var(--color-status-overdue-bg)] text-[var(--color-status-overdue)]"
                              : "bg-[var(--color-surface)] text-[var(--color-text-tertiary)]"
                          )}
                        >
                          {item.priority}
                        </span>
                      )}
                      {assigned && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border-secondary)]">
                          @{assigned.name}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] p-1 rounded transition-colors"
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
            <div className="flex items-center gap-2 text-xs text-[var(--color-status-pending)] bg-[var(--color-status-pending-bg)] p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Approaching maximum recommended 50 items per list ({items.length}/50).</span>
            </div>
          )}
        </Card>

        {errors.form && (
          <p className="text-xs text-[var(--color-danger)] font-semibold">{errors.form}</p>
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
              variant="whatsapp"
              loading={loading}
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-initial"
            >
              <Send className="w-4 h-4 mr-1.5" /> Save &amp; Dispatch to WhatsApp
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
