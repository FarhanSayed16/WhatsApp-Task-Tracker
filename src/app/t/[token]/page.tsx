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
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  ShieldCheck,
  Lock,
  MessageSquare,
  Sparkles,
  Info,
  Check,
} from "lucide-react";

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

    // Avoid recording open repeatedly in same session for same member
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
      toast.error("Please pick your name above before ticking tasks!");
      return;
    }

    const previousItems = [...items];
    const previousCompletions = [...completions];

    if (isCurrentlyDone) {
      // Member is attempting to UNDO
      const existingComp = completions.find((c) => c.task_item_id === item.id);
      if (existingComp && existingComp.member_id && existingComp.member_id !== selectedMember.id) {
        toast.error("Only the member who ticked this task can undo it.");
        return;
      }

      if (data?.verify_required && item.status === "verified") {
        toast.error("Verified tasks cannot be undone by members.");
        return;
      }

      // Optimistic Undo
      const updatedItems = items.map((it) =>
        it.id === item.id
          ? { ...it, status: "pending" as const, completed_by: null, completed_at: null, verified_at: null }
          : it
      );
      const updatedCompletions = completions.filter((c) => c.task_item_id !== item.id);

      setLocalItems(updatedItems);
      setLocalCompletions(updatedCompletions);

      try {
        const res = await fetch(`/api/t/${token}/items/${item.id}/undo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: selectedMember.id }),
        });
        const json = await res.json();
        if (!res.ok || json.success === false) {
          throw new Error(json?.error?.message || "Failed to undo task");
        }
        mutate();
      } catch (err: any) {
        // Revert optimistic update
        setLocalItems(previousItems);
        setLocalCompletions(previousCompletions);
        toast.error(err.message || "Failed to undo task");
      }
    } else {
      // Member is ticking COMPLETE
      const targetStatus = data?.verify_required ? ("done" as const) : ("verified" as const);
      const now = new Date().toISOString();

      // Optimistic Complete
      const updatedItems = items.map((it) =>
        it.id === item.id
          ? {
              ...it,
              status: targetStatus,
              completed_by: selectedMember.id,
              completed_at: now,
              verified_at: targetStatus === "verified" ? now : null,
            }
          : it
      );
      const newCompletion: Completion = {
        id: "temp-" + Date.now(),
        task_item_id: item.id,
        member_id: selectedMember.id,
        status: targetStatus,
        completed_at: now,
      };
      const updatedCompletions = [...completions.filter((c) => c.task_item_id !== item.id), newCompletion];

      setLocalItems(updatedItems);
      setLocalCompletions(updatedCompletions);

      try {
        const res = await fetch(`/api/t/${token}/items/${item.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: selectedMember.id }),
        });
        const json = await res.json();
        if (!res.ok || json.success === false) {
          throw new Error(json?.error?.message || "Failed to complete task");
        }
        mutate();
      } catch (err: any) {
        // Revert optimistic update
        setLocalItems(previousItems);
        setLocalCompletions(previousCompletions);
        toast.error(err.message || "Failed to complete task");
      }
    }
  };

  // Note Modal Save
  const handleSaveNote = async () => {
    if (!noteModalItem || !selectedMember) return;

    try {
      setSavingNote(true);
      const res = await fetch(`/api/t/${token}/items/${noteModalItem.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedMember.id,
          note: itemNoteText.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to save note");
      }
      toast.success("Note saved!");
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
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center">
        <div className="w-full max-w-lg space-y-4">
          <div className="h-32 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </main>
    );
  }

  // Error / Not Found / Expired state
  if (error || !data || data.status === "expired") {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Task List Unavailable
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              This task list link does not exist, has expired, or was archived by the professor.
            </p>
          </div>
          <div className="pt-2 text-xs text-slate-400">
            If you believe this is a mistake, please contact your group coordinator on WhatsApp.
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
    <main className="min-h-screen bg-slate-50/70 dark:bg-slate-950 p-3 sm:p-6 flex flex-col items-center pb-24">
      <div className="w-full max-w-lg space-y-4 sm:space-y-6">
        {/* Read-only / Overdue banners */}
        {isReadOnly && (
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-300 text-xs font-medium">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              This task list is <strong>read-only</strong> ({task_list.status === "completed" ? "all tasks completed" : "archived/expired"}).
            </span>
          </div>
        )}

        {isOverdue && !isReadOnly && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 text-rose-700 dark:text-rose-400 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              Tasks are <strong>overdue</strong>! Due was {formatRelativeTime(task_list.due_at!)}.
            </span>
          </div>
        )}

        {/* Task List Header Card */}
        <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {task_list.group_name}
            </span>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {task_list.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tap any task to check it off. Changes sync instantly with your professor and group.
            </p>
          </div>

          {/* Member Progress Bar with Confetti */}
          <MemberProgress
            completedCount={completedCount}
            totalCount={items.length}
            className="pt-2"
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
        <Card className="p-5 sm:p-6 space-y-4 border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Checklist ({items.length})
              </h2>
              {data.verify_required && (
                <Badge variant="verified" className="text-[10px] py-0.5">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verify Mode
                </Badge>
              )}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {completedCount}/{items.length} Done
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
        <div className="text-center space-y-1.5 pt-4 text-xs text-slate-400">
          <p className="flex items-center justify-center gap-1 font-medium">
            <span>Powered by WhatsApp Task Tracker</span>
          </p>
          <p className="text-[11px] text-slate-400">
            No login or password needed. Keep this link to view group progress anytime.
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
            <p className="text-xs text-slate-500">
              Adding a note for: <strong>{noteModalItem.text}</strong>
            </p>
            <textarea
              value={itemNoteText}
              onChange={(e) => setItemNoteText(e.target.value)}
              placeholder="e.g. Completed page 1-4, handed over key to Sarah..."
              rows={3}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
