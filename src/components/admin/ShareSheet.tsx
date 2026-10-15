"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import {
  buildTaskMessage,
  buildReminderMessage,
  waLink,
  inspectWaUrl,
  ReminderType,
} from "@/lib/whatsapp";
import {
  Share2,
  Copy,
  ExternalLink,
  AlertTriangle,
  Send,
  Bell,
  Check,
  CheckCircle2,
  Phone,
  User,
  Smartphone,
} from "lucide-react";

export interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  taskList: {
    id: string;
    token: string;
    title: string;
    group_name: string;
    list_date: string;
    due_at?: string | null;
    member_link?: string;
    total_items?: number;
    completed_items?: number;
  };
  items?: Array<{
    id: string;
    text: string;
    status: string;
    assigned_member_id?: string | null;
  }>;
  members?: Array<{
    id: string;
    name: string;
    phone?: string | null;
    active: boolean;
  }>;
  initialMode?: "share" | "reminder";
  onShareLogged?: () => void;
}

export function ShareSheet({
  isOpen,
  onClose,
  taskList,
  items = [],
  members = [],
  initialMode = "share",
  onShareLogged,
}: ShareSheetProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"share" | "reminder">(initialMode);
  const [reminderType, setReminderType] = useState<ReminderType>("group");
  const [messageText, setMessageText] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [markedSent, setMarkedSent] = useState(false);
  const [loggingShare, setLoggingShare] = useState(false);

  const publicLink =
    taskList.member_link ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/t/${taskList.token}`
      : `/t/${taskList.token}`);

  const pendingItems = items.filter(
    (i) => i.status === "pending" || i.status === "done"
  );

  // Generate initial message according to active tab and reminder type
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === "share") {
      const msg = buildTaskMessage({
        title: taskList.title,
        groupName: taskList.group_name,
        dateStr: taskList.list_date,
        dueTimeStr: taskList.due_at || undefined,
        items: items.map((i) => i.text),
        link: publicLink,
      });
      setMessageText(msg);
    } else {
      const selectedMember = members.find((m) => m.id === selectedMemberId);
      const memberPending = selectedMemberId
        ? items
            .filter(
              (i) =>
                (i.assigned_member_id === selectedMemberId || !i.assigned_member_id) &&
                i.status !== "verified"
            )
            .map((i) => i.text)
        : pendingItems.map((i) => i.text);

      const msg = buildReminderMessage({
        type: reminderType,
        title: taskList.title,
        groupName: taskList.group_name,
        pendingItems: memberPending.length > 0 ? memberPending : ["Remaining pending tasks"],
        link: publicLink,
        memberName: selectedMember?.name,
        dueTimeStr: taskList.due_at || undefined,
      });
      setMessageText(msg);
    }
    setMarkedSent(false);
  }, [
    isOpen,
    activeTab,
    reminderType,
    selectedMemberId,
    taskList,
    items,
    members,
    publicLink,
  ]);

  const urlStats = inspectWaUrl(messageText);

  const logShareEvent = async (
    channel: "whatsapp_group" | "whatsapp_individual" | "copy" | "native_share",
    memberId?: string | null
  ) => {
    try {
      setLoggingShare(true);
      const endpoint =
        activeTab === "share"
          ? `/api/admin/task-lists/${taskList.id}/share`
          : `/api/admin/task-lists/${taskList.id}/remind`;

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          member_id: memberId || null,
        }),
      });

      setMarkedSent(true);
      onShareLogged?.();
    } catch {
      // Background logging shouldn't block the user
    } finally {
      setLoggingShare(false);
    }
  };

  const handleOpenWhatsApp = async (phone?: string | null, memberId?: string | null) => {
    const link = waLink(messageText, phone);
    window.open(link, "_blank");
    const channel = phone ? "whatsapp_individual" : "whatsapp_group";
    await logShareEvent(channel, memberId);
    toast.success("Opened WhatsApp & logged share event!");
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      await logShareEvent("copy");
      toast.success("Message copied to clipboard!");
    } catch {
      toast.error("Failed to copy message");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      toast.success("Member link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: taskList.title,
          text: messageText,
          url: publicLink,
        });
        await logShareEvent("native_share");
        toast.success("Shared via device!");
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyMessage();
    }
  };

  const handleManualMarkSent = async () => {
    await logShareEvent(
      activeTab === "share" ? "whatsapp_group" : "whatsapp_individual"
    );
    toast.success("Marked as dispatched!");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-emerald-600" />
          <span>Dispatch to WhatsApp</span>
        </div>
      }
      description={`Share "${taskList.title}" with ${taskList.group_name}`}
    >
      <div className="space-y-4 pt-1">
        {/* Share vs Reminder Mode Switch */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <Tabs
            tabs={[
              { id: "share", label: "Initial Share", icon: <Send className="w-3.5 h-3.5" /> },
              { id: "reminder", label: "Reminder", icon: <Bell className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as "share" | "reminder")}
          />

          {activeTab === "reminder" && (
            <div className="flex items-center gap-1.5 text-xs">
              {(["group", "individual", "overdue", "closure"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReminderType(r)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors capitalize ${
                    reminderType === r
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Individual / pending member roster */}
        {activeTab === "reminder" &&
          (reminderType === "individual" || reminderType === "overdue") &&
          members.length > 0 && (
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {reminderType === "overdue"
                ? "Remind a member (pending items):"
                : "Select Member to Remind:"}
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs p-2 text-slate-900 dark:text-slate-100"
            >
              <option value="">Choose a member...</option>
              {members
                .filter((m) => m.active !== false)
                .map((m) => {
                  const pendingForMember = items.filter(
                    (i) =>
                      i.status === "pending" &&
                      (!i.assigned_member_id || i.assigned_member_id === m.id)
                  ).length;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.phone ? ` (${m.phone})` : ""}
                      {pendingForMember > 0
                        ? ` — ${pendingForMember} pending`
                        : ""}
                    </option>
                  );
                })}
            </select>
            {selectedMemberId && (
              <button
                type="button"
                className="text-[11px] font-semibold text-emerald-600 hover:underline"
                onClick={() => {
                  const m = members.find((x) => x.id === selectedMemberId);
                  if (m?.phone) handleOpenWhatsApp(m.phone, m.id);
                  else handleOpenWhatsApp(undefined, selectedMemberId);
                }}
              >
                Open WhatsApp for selected member →
              </button>
            )}
          </div>
        )}

        {/* Message Preview Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Message Preview (Editable):
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                {messageText.length} chars
              </span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded font-semibold ${
                  urlStats.isExceeded
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                    : urlStats.isWarning
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                    : "text-slate-400"
                }`}
              >
                URL: {urlStats.length} / 2048
              </span>
            </div>
          </div>

          <textarea
            rows={7}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs p-3.5 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 leading-relaxed resize-none"
          />

          {urlStats.isExceeded && (
            <p className="text-xs text-rose-500 flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              URL length exceeds 2048 characters. Please shorten title or items before sending.
            </p>
          )}
        </div>

        {/* Member Link Quick Copy */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 flex-1 truncate font-mono text-slate-600 dark:text-slate-400 text-[11px]">
            {publicLink}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 shrink-0"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => handleOpenWhatsApp()}
            className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-md shadow-emerald-600/20 text-sm font-bold py-3"
          >
            <Send className="w-4 h-4 mr-2" />
            Open in WhatsApp
          </Button>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyMessage}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Message
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNativeShare}
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5" /> Share Device
            </Button>

            <Button
              type="button"
              variant={markedSent ? "secondary" : "ghost"}
              size="sm"
              loading={loggingShare}
              onClick={handleManualMarkSent}
              className={
                markedSent
                  ? "col-span-2 sm:col-span-1 text-emerald-600 font-semibold"
                  : "col-span-2 sm:col-span-1 text-slate-500"
              }
            >
              {markedSent ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Marked Sent
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" /> Mark as Sent
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Direct Individual Member Links if available */}
        {members.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Send to Member Directly ({members.filter((m) => m.phone).length} with phones):
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {member.name}
                    </span>
                    {member.phone && (
                      <span className="text-slate-400 text-[11px]">
                        ({member.phone})
                      </span>
                    )}
                  </div>
                  {member.phone ? (
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(member.phone, member.id)}
                      className="text-emerald-600 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <Send className="w-3 h-3" /> WhatsApp
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[10px]">No phone</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
