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
  Sparkles,
  Loader2,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";

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
    active?: boolean;
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
  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [aiLang, setAiLang] = useState<"en" | "hi" | "mr">("en");
  const [aiTone, setAiTone] = useState<"polite" | "urgent" | "firm">("polite");
  const [messageTemplates, setMessageTemplates] = useState<
    Array<{ id: string; name: string; body: { text?: string } }>
  >([]);
  const [defaultWaPhone, setDefaultWaPhone] = useState<string | null>(null);

  const publicLink =
    taskList.member_link ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/t/${taskList.token}`
      : `/t/${taskList.token}`);

  const pendingItems = items.filter(
    (i) => i.status === "pending" || i.status === "done"
  );

  // Load message templates + default WhatsApp number when sheet opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [tplRes, settingsRes] = await Promise.all([
          fetch("/api/admin/templates?type=message"),
          fetch("/api/admin/settings"),
        ]);
        const tplJson = await tplRes.json();
        const settingsJson = await settingsRes.json();
        if (!cancelled && tplRes.ok) {
          setMessageTemplates(Array.isArray(tplJson.data) ? tplJson.data : []);
        }
        if (!cancelled && settingsRes.ok) {
          setDefaultWaPhone(settingsJson.data?.default_wa_phone || null);
        }
      } catch {
        /* optional enrichment */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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

  const handleAiDraftReminder = async () => {
    try {
      setIsDraftingAi(true);
      const res = await fetch("/api/admin/ai/draft-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_list_id: taskList.id,
          language: aiLang,
          tone: aiTone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to draft reminder with AI");

      if (json.data?.message) {
        setMessageText(json.data.message);
        toast.success(
          `AI drafted reminder in ${aiLang === "hi" ? "Hindi" : aiLang === "mr" ? "Marathi" : "English"}!`
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate reminder");
    } finally {
      setIsDraftingAi(false);
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
                      ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
          <div className="space-y-2 p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-primary)]">
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
              {reminderType === "overdue"
                 ? "Remind a member (pending items):"
                : "Select Member to Remind:"}
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-input)] text-xs p-2 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-primary-subtle)]"
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
                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
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

        {/* Gemini AI Reminder Assistant (Phase 15.4) */}
        {activeTab === "reminder" && (
          <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 space-y-2.5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Gemini AI Reminder Assistant</span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAiDraftReminder}
                disabled={isDraftingAi}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-7 px-2.5 shadow-sm"
              >
                {isDraftingAi ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Draft with AI
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Language:</span>
                <button
                  type="button"
                  onClick={() => setAiLang("en")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    aiLang === "en"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-purple-200/60 dark:border-purple-900/40"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setAiLang("hi")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    aiLang === "hi"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-purple-200/60 dark:border-purple-900/40"
                  }`}
                >
                  हिंदी
                </button>
                <button
                  type="button"
                  onClick={() => setAiLang("mr")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    aiLang === "mr"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-purple-200/60 dark:border-purple-900/40"
                  }`}
                >
                  मराठी
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Tone:</span>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value as any)}
                  className="px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[11px] font-medium focus:outline-none"
                >
                  <option value="polite">Polite &amp; Encouraging</option>
                  <option value="urgent">Urgent (Overdue)</option>
                  <option value="firm">Firm &amp; Direct</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Message Preview Textarea */}
        <div className="space-y-1.5">
          {messageTemplates.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500 shrink-0">Use template:</span>
              <select
                className="flex-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                defaultValue=""
                onChange={(e) => {
                  const tpl = messageTemplates.find((t) => t.id === e.target.value);
                  if (tpl?.body?.text) {
                    const filled = tpl.body.text
                      .replace(/\{\{title\}\}/gi, taskList.title)
                      .replace(/\{\{group\}\}/gi, taskList.group_name)
                      .replace(/\{\{link\}\}/gi, publicLink);
                    setMessageText(filled);
                  }
                  e.target.value = "";
                }}
              >
                <option value="">Select a message template…</option>
                {messageTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--color-text-primary)]">
              Message Preview (Editable):
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-tertiary)]">
                {messageText.length} chars
              </span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded font-semibold ${
                  urlStats.isExceeded
                    ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                    : urlStats.isWarning
                    ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                    : "text-[var(--color-text-tertiary)]"
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
            className="w-full rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-input)] text-[var(--color-text-primary)] font-mono text-xs p-3.5 focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-primary-subtle)] leading-relaxed resize-none"
          />

          {urlStats.isExceeded && (
            <p className="text-xs text-[var(--color-danger)] flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              URL length exceeds 2048 characters. Please shorten title or items before sending.
            </p>
          )}
        </div>

        {/* Member Link Quick Copy */}
        <div className="p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-primary)] flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 flex-1 truncate font-mono text-[var(--color-text-secondary)] text-[11px]">
            {publicLink}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-[var(--color-primary)] hover:underline font-semibold flex items-center gap-1 shrink-0"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            variant="whatsapp"
            size="lg"
            onClick={() => handleOpenWhatsApp(defaultWaPhone)}
            className="w-full text-sm font-bold py-3 flex items-center justify-center gap-2"
          >
            <WhatsAppIcon className="w-5 h-5 mr-1" />
            {defaultWaPhone
              ? `Open WhatsApp (+${defaultWaPhone})`
              : "Open in WhatsApp"}
          </Button>
          {defaultWaPhone && (
            <p className="text-[11px] text-center text-[var(--color-text-tertiary)]">
              Opens a chat with your saved test number and the checklist + member link pre-filled.
              Change this under Settings.
            </p>
          )}

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
                  ? "col-span-2 sm:col-span-1 text-[var(--color-primary)] font-semibold"
                  : "col-span-2 sm:col-span-1 text-[var(--color-text-secondary)]"
              }
            >
              {markedSent ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[var(--color-primary)]" />
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
