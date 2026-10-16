"use client";

import React, { use, useState, useEffect, useRef } from "react";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { Member, TaskItem, Completion } from "@/types";
import { NamePicker } from "@/components/member/NamePicker";
import { TaskChecklist } from "@/components/member/TaskChecklist";
import { MemberProgress } from "@/components/member/MemberProgress";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  AlertCircle,
  Calendar,
  Clock,
  ShieldCheck,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface PublicTaskListResponse {
  status: "active" | "readonly" | "expired";
  expires_at: string;
  verify_required: boolean;
  task_list: {
    id: string;
    token: string;
    title: string;
    group_name: string;
    list_date: string;
    due_at?: string | null;
    status: "draft" | "active" | "completed" | "archived";
  };
  items: TaskItem[];
  members: Member[];
  completions: Completion[];
}

export default function PublicMemberPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { toast } = useToast();

  // SWR polling every 12 seconds to keep member view in sync
  const { data, error, isLoading, mutate } = useSWRFetch<PublicTaskListResponse>(
    `/api/t/${token}`,
    {
      refreshInterval: 12000,
      revalidateOnFocus: true,
    }
  );

  // Selected Member State
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const hasRecordedOpenRef = useRef<string | null>(null);

  // Note Modal State
  const [noteModalItem, setNoteModalItem] = useState<TaskItem | null>(null);
  const [itemNoteText, setItemNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Local optimistic state
  const [localItems, setLocalItems] = useState<TaskItem[] | null>(null);
  const [localCompletions, setLocalCompletions] = useState<Completion[] | null>(null);

  // Sync server data to local state when received
  useEffect(() => {
    if (data) {
      setLocalItems(data.items);
      setLocalCompletions(data.completions);
    }
  }, [data]);

  // Record open event when member is selected
  useEffect(() => {
    if (!selectedMember || !token) return;

    if (hasRecordedOpenRef.current === selectedMember.id) return;
    hasRecordedOpenRef.current = selectedMember.id;

    fetch(`/api/t/${token}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: selectedMember.id }),
    }).catch((err) => {
      console.warn("Failed to record open:", err);
    });
  }, [selectedMember, token]);

  const items = localItems || data?.items || [];
  const completions = localCompletions || data?.completions || [];
  const members = data?.members || [];
  const isReadOnly = data?.status === "readonly" || data?.status === "expired";

  // Calculate completed count
  const completedCount = items.filter((item) => {
    const comp = completions.find((c) => c.task_item_id === item.id);
    return item.status === "done" || item.status === "verified" || !!comp;
  }).length;

  const isAllComplete = items.length > 0 && completedCount === items.length;

  // Toggle Item Handler with Optimistic Updates
  const handleToggleItem = async (item: TaskItem, isCurrentlyDone: boolean) => {
    if (isReadOnly) {
      toast.info("This task list is read-only.");
      return;
    }

    if (!selectedMember) {
      toast.error("Please pick your name before checking off tasks.");
      return;
    }

    const newDoneState = !isCurrentlyDone;

    // Optimistic UI update
    setLocalItems((prev) => {
      if (!prev) return prev;
      return prev.map((t) =>
        t.id === item.id
          ? {
              ...t,
              status: newDoneState
                ? data?.verify_required
                  ? "done"
                  : "verified"
                : "pending",
            }
          : t
      );
    });

    if (newDoneState) {
      const mockCompletion: Completion = {
        id: "temp-" + Date.now(),
        task_item_id: item.id,
        member_id: selectedMember.id,
        status: data?.verify_required ? "done" : "verified",
        completed_at: new Date().toISOString(),
      };
      setLocalCompletions((prev) => [...(prev || []), mockCompletion]);
    } else {
      setLocalCompletions((prev) =>
        (prev || []).filter((c) => c.task_item_id !== item.id)
      );
    }

    try {
      const url = `/api/t/${token}/items/${item.id}/${newDoneState ? "complete" : "undo"}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: selectedMember.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to update task state");
      }

      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update item");
      mutate();
    }
  };

  const handleSaveNote = async () => {
    if (!noteModalItem || !selectedMember) return;
    try {
      setSavingNote(true);
      const res = await fetch(`/api/t/${token}/items/${noteModalItem.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedMember.id,
          note: itemNoteText,
        }),
      });

      if (!res.ok) throw new Error("Failed to save note");
      toast.success("Note saved and task marked done!");
      setNoteModalItem(null);
      setItemNoteText("");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <main className="min-h-screen bg-[var(--color-canvas)] p-4 sm:p-6 flex flex-col items-center">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton variant="card" className="h-40" />
          <Skeleton variant="card" className="h-28" />
          <Skeleton variant="card" className="h-64" />
        </div>
      </main>
    );
  }

  // Error / Not Found / Expired state
  if (error || !data || data.status === "expired") {
    return (
      <main className="min-h-screen bg-[var(--color-canvas)] p-4 sm:p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-xl bg-[var(--color-status-overdue-bg)] text-[var(--color-status-overdue)] flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
              Task List Unavailable
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
              This task list link does not exist, has expired, or was archived by the professor.
            </p>
          </div>
          <div className="pt-2 text-xs text-[var(--color-text-tertiary)]">
            If you believe this is a mistake, please check your group on WhatsApp.
          </div>
        </Card>
      </main>
    );
  }

  const { task_list } = data;
  const isOverdue =
    task_list.due_at &&
    new Date(task_list.due_at).getTime() < Date.now() &&
    !isAllComplete;

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] p-3 sm:p-6 flex flex-col items-center pb-24">
      <div className="w-full max-w-lg space-y-4 sm:space-y-5">
        {/* Top Brand Tag */}
        <div className="flex items-center justify-between px-1">
          <Logo size="xs" showWordmark />
          <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
            Member Dispatch
          </span>
        </div>

        {/* Read-only / Overdue banners */}
        {isReadOnly && (
          <div className="p-3.5 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-primary)] flex items-center gap-3 text-[var(--color-text-secondary)] text-xs font-medium">
            <Lock className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
            <span>
              This task list is <strong>read-only</strong> ({task_list.status === "completed" ? "all tasks completed" : "archived"}).
            </span>
          </div>
        )}

        {isOverdue && !isReadOnly && (
          <div className="p-3.5 rounded-xl bg-[var(--color-status-overdue-bg)] border border-[var(--color-status-overdue)]/20 flex items-center gap-3 text-[var(--color-status-overdue)] text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Tasks are <strong>overdue</strong>! Deadline was {formatRelativeTime(task_list.due_at!)}.
            </span>
          </div>
        )}

        {/* Task List Header Card */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] border border-[var(--color-primary)]/20">
              {task_list.group_name}
            </span>

            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(task_list.list_date)}
              </span>
              {task_list.due_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Due: {new Date(task_list.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {task_list.title}
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Tap any task to mark it done. Updates sync live with your professor.
            </p>
          </div>

          {/* Member Progress Bar with Confetti */}
          <MemberProgress
            completedCount={completedCount}
            totalCount={items.length}
            className="pt-1"
          />
        </Card>

        {/* Who Are You? Member Picker Card */}
        <NamePicker
          members={members}
          selectedMemberId={selectedMember?.id || null}
          onSelectMember={(m) => setSelectedMember(m)}
          disabled={isReadOnly}
        />

        {/* Checklist Container */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Checklist ({items.length})
              </h2>
              {data.verify_required && (
                <Badge variant="verified" className="text-[10px] py-0.5">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verify Mode
                </Badge>
              )}
            </div>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {completedCount} of {items.length} done
            </span>
          </div>

          <TaskChecklist
            items={items}
            completions={completions}
            members={members}
            currentMemberId={selectedMember?.id || null}
            readOnly={isReadOnly}
            onToggleItem={handleToggleItem}
            onAddNote={(item) => {
              setNoteModalItem(item);
              const comp = completions.find((c) => c.task_item_id === item.id);
              setItemNoteText(comp?.note || "");
            }}
          />
        </Card>

        {/* Footer info */}
        <div className="text-center space-y-1 pt-3 text-xs text-[var(--color-text-tertiary)]">
          <p className="font-medium">
            TaskTracker · WhatsApp Task Dispatch
          </p>
          <p className="text-[11px]">
            No login or app install needed. Re-open this link anytime to view progress.
          </p>
        </div>
      </div>

      {/* Note Modal */}
      {noteModalItem && (
        <Modal
          isOpen={true}
          onClose={() => setNoteModalItem(null)}
          title="Add Note to Task"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Adding a note for: <strong>{noteModalItem.text}</strong>
            </p>
            <textarea
              value={itemNoteText}
              onChange={(e) => setItemNoteText(e.target.value)}
              placeholder="e.g. Completed experiments, soft copy emailed..."
              rows={3}
              className="w-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-input)] p-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNoteModalItem(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleSaveNote}
                loading={savingNote}
              >
                Save & Complete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
