"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import {
  buildTaskMessage,
  buildAssignmentMessage,
  buildReminderMessage,
  formatWaDueTime,
  waLink,
  waWebLink,
  inspectWaUrl,
  sanitizeWhatsAppText,
  ReminderType,
} from "@/lib/whatsapp";
import {
  Share2,
  Copy,
  AlertTriangle,
  Send,
  Bell,
  Check,
  CheckCircle2,
  User,
  Smartphone,
  Sparkles,
  Loader2,
  Globe,
  ExternalLink,
  Edit3,
  Eye,
  ShieldCheck,
  Wifi,
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
  /** When true (after create), use "New checklist assigned" copy */
  isAssignment?: boolean;
  /** Prefill reminder subtype when opening in reminder mode */
  initialReminderType?: ReminderType;
  onShareLogged?: () => void;
  /** Called after a successful open/copy so parent can mark reminder sent */
  onDispatched?: (payload: {
    channel: string;
    mode: "share" | "reminder";
    reminderType: ReminderType;
  }) => void;
}

/**
 * Interactive WhatsApp Message Bubble Simulator
 * Renders an authentic WhatsApp outgoing chat bubble with live formatted markdown
 */
function WhatsAppBubblePreview({
  text,
  groupName,
  onCopy,
  copied,
}: {
  text: string;
  groupName: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const lines = text.split("\n");
  const [timeStr, setTimeStr] = useState("Just now");

  useEffect(() => {
    setTimeStr(
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-900/15 dark:border-emerald-700/30 shadow-sm bg-[var(--color-surface)]">
      {/* WhatsApp Chat Top Bar Mockup */}
      <div className="bg-[#005c4b] dark:bg-[#1f2c34] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-600/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-white/20">
            <WhatsAppIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight truncate">{groupName || "WhatsApp Group"}</p>
            <p className="text-[10px] text-emerald-100/75 leading-tight truncate">tap here for group info</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-800/60 dark:bg-emerald-900/60 text-emerald-100 border border-emerald-700/40">
            <ShieldCheck className="w-3 h-3 text-emerald-300" /> Anti-Glitch Verified
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-white transition-all flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Wallpaper Canvas */}
      <div className="p-3 bg-[#efeae2] dark:bg-[#0b141a] max-h-[190px] overflow-y-auto flex flex-col">
        {/* Outgoing WhatsApp Bubble */}
        <div className="self-end max-w-[95%] sm:max-w-[88%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] p-3.5 shadow-sm border border-[#c2e7be] dark:border-[#026b57] text-xs leading-relaxed space-y-1 relative">
          {lines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) {
              return <div key={idx} className="h-1.5" />;
            }

            // Divider dashes
            if (trimmed.startsWith("----") || trimmed.startsWith("====")) {
              return (
                <div
                  key={idx}
                  className="my-1.5 border-t border-emerald-900/15 dark:border-emerald-300/20"
                />
              );
            }

            // Entirely Bold Header: *TITLE*
            const isEntirelyBold = /^\*([^*]+)\*$/.test(trimmed);
            if (isEntirelyBold) {
              const content = trimmed.replace(/^\*|\*$/g, "");
              return (
                <p key={idx} className="font-bold tracking-tight text-[#0f291e] dark:text-emerald-100 text-[13px]">
                  {content}
                </p>
              );
            }

            // Label bold prefix: *Label:* value
            const labelMatch = trimmed.match(/^\*([^*]+):\*\s*(.*)$/);
            if (labelMatch) {
              return (
                <p key={idx} className="text-[#111b21] dark:text-[#e9edef]">
                  <strong className="font-bold text-[#0f291e] dark:text-white">{labelMatch[1]}:</strong>{" "}
                  <span>{labelMatch[2]}</span>
                </p>
              );
            }

            // Url line
            const isUrl = /(https?:\/\/[^\s]+)/.test(line);
            if (isUrl) {
              const parts = line.split(/(https?:\/\/[^\s]+)/g);
              return (
                <p key={idx} className="break-all pt-0.5">
                  {parts.map((p, pIdx) =>
                    /(https?:\/\/[^\s]+)/.test(p) ? (
                      <span key={pIdx} className="text-[#027eb5] dark:text-[#53bdeb] font-semibold underline">
                        {p}
                      </span>
                    ) : (
                      <span key={pIdx}>{p}</span>
                    )
                  )}
                </p>
              );
            }

            // Numbered or bullet list item
            const isListItem = /^(\d+\.|\-)\s+(.*)$/.test(trimmed);
            if (isListItem) {
              return (
                <p key={idx} className="text-[#111b21] dark:text-[#e9edef] pl-1 font-medium">
                  {line}
                </p>
              );
            }

            return (
              <p key={idx} className="text-[#111b21] dark:text-[#e9edef]">
                {line}
              </p>
            );
          })}

          {/* Timestamp and Double Blue Read Ticks */}
          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-emerald-200/70 pt-1 select-none">
            <span>{timeStr}</span>
            <span className="text-sky-500 dark:text-sky-400 font-bold tracking-tighter">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShareSheet({
  isOpen,
  onClose,
  taskList,
  items = [],
  members = [],
  initialMode = "share",
  isAssignment = false,
  initialReminderType = "group",
  onShareLogged,
  onDispatched,
}: ShareSheetProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"share" | "reminder">(initialMode);
  const [reminderType, setReminderType] = useState<ReminderType>(initialReminderType);
  const [messageText, setMessageText] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [markedSent, setMarkedSent] = useState(false);
  const [loggingShare, setLoggingShare] = useState(false);
  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [aiLang, setAiLang] = useState<"en" | "hi" | "mr">("en");
  const [aiTone, setAiTone] = useState<"polite" | "urgent" | "firm">("polite");
  const [previewView, setPreviewView] = useState<"bubble" | "raw">("bubble");
  const [messageStyle, setMessageStyle] = useState<"numbered" | "bullets">("numbered");
  const [copiedClean, setCopiedClean] = useState(false);
  const [showHostConfig, setShowHostConfig] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState<
    Array<{ id: string; name: string; body: { text?: string } }>
  >([]);
  const [defaultWaPhone, setDefaultWaPhone] = useState<string | null>(null);

  // Network IP auto-detection state
  const [detectedWifiUrl, setDetectedWifiUrl] = useState<string | null>(null);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [networkInterfaces, setNetworkInterfaces] = useState<
    Array<{ name: string; ip: string; url: string; isWifi: boolean }>
  >([]);

  // Persistent custom base URL (e.g. Wi-Fi IP or Vercel URL)
  const [customHost, setCustomHost] = useState("");
  const [browserOrigin, setBrowserOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wtt_custom_base_url");
      if (saved) setCustomHost(saved);
      setBrowserOrigin(window.location.origin);
    }
  }, []);

  /** How to deliver: pick any WA chat/group (default), or a saved personal number */
  const [sendTarget, setSendTarget] = useState<"pick_chat" | "saved_number">("pick_chat");

  // Determine effective base URL
  const effectiveBaseUrl = customHost.trim()
    ? customHost.trim().replace(/\/$/, "")
    : browserOrigin;

  const publicLink = effectiveBaseUrl
    ? `${effectiveBaseUrl}/t/${taskList.token}`
    : taskList.member_link || `/t/${taskList.token}`;

  const isLocalhostLink = /localhost|127\.0\.0\.1/i.test(effectiveBaseUrl);

  const handleApplyBaseUrl = async (newBaseUrl: string) => {
    const clean = newBaseUrl.trim().replace(/\/$/, "");
    setCustomHost(clean);
    if (typeof window !== "undefined") {
      if (clean) {
        localStorage.setItem("wtt_custom_base_url", clean);
      } else {
        localStorage.removeItem("wtt_custom_base_url");
      }
    }
    // Also sync to server settings in background
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_base_url: clean || null }),
      });
    } catch {
      // Non-blocking
    }
    toast.success(
      clean.includes("localhost") || !clean
        ? "Applied Localhost link"
        : `Switched link to ${clean}! Students can now open it on mobile.`
    );
  };

  const pendingItems = items.filter(
    (i) => i.status === "pending" || i.status === "done"
  );

  // Load message templates + default WhatsApp number + network IP when sheet opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [tplRes, settingsRes, netRes] = await Promise.all([
          fetch("/api/admin/templates?type=message"),
          fetch("/api/admin/settings"),
          fetch("/api/admin/network-ip"),
        ]);
        const tplJson = await tplRes.json();
        const settingsJson = await settingsRes.json();
        const netJson = await netRes.json().catch(() => ({}));

        if (!cancelled && tplRes.ok) {
          setMessageTemplates(Array.isArray(tplJson.data) ? tplJson.data : []);
        }
        if (!cancelled && settingsRes.ok) {
          const phone = settingsJson.data?.default_wa_phone || null;
          setDefaultWaPhone(phone);
          setSendTarget("pick_chat");

          // If server has a saved public_base_url and localStorage doesn't have one, adopt it
          if (
            settingsJson.data?.public_base_url &&
            typeof window !== "undefined" &&
            !localStorage.getItem("wtt_custom_base_url")
          ) {
            setCustomHost(settingsJson.data.public_base_url);
          }
        }
        if (!cancelled && netRes.ok && netJson?.data) {
          if (netJson.data.detectedUrl) {
            setDetectedWifiUrl(netJson.data.detectedUrl);
            setDetectedIp(netJson.data.detectedIp);
          }
          if (Array.isArray(netJson.data.interfaces)) {
            setNetworkInterfaces(netJson.data.interfaces);
          }
        }
      } catch {
        /* optional enrichment */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Sync tab when parent opens sheet for assignment / reminder
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialMode);
    setReminderType(initialReminderType);
  }, [isOpen, initialMode, initialReminderType]);

  // Generate initial message according to active tab, reminder type, style, and current publicLink
  useEffect(() => {
    if (!isOpen) return;

    const dueLabel = formatWaDueTime(taskList.due_at);

    if (activeTab === "share") {
      const builder = isAssignment ? buildAssignmentMessage : buildTaskMessage;
      const msg = builder({
        title: taskList.title,
        groupName: taskList.group_name,
        dateStr: taskList.list_date,
        dueTimeStr: dueLabel,
        items: items.map((i) => i.text),
        link: publicLink,
        style: messageStyle,
      });
      setMessageText(sanitizeWhatsAppText(msg));
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
        : pendingItems
            .filter((i) => i.status === "pending")
            .map((i) => i.text);

      const msg = buildReminderMessage({
        type: reminderType,
        title: taskList.title,
        groupName: taskList.group_name,
        pendingItems:
          memberPending.length > 0 ? memberPending : ["Remaining pending tasks"],
        link: publicLink,
        memberName: selectedMember?.name,
        dueTimeStr: dueLabel,
        style: messageStyle,
      });
      setMessageText(sanitizeWhatsAppText(msg));
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
    isAssignment,
    messageStyle,
  ]);

  const targetPhone =
    sendTarget === "saved_number" && defaultWaPhone ? defaultWaPhone : null;
  const urlStats = inspectWaUrl(messageText, targetPhone);

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
      onDispatched?.({
        channel,
        mode: activeTab,
        reminderType,
      });
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
        setMessageText(sanitizeWhatsAppText(json.data.message));
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

  /**
   * Dispatches to WhatsApp (App or Web)
   * Also automatically copies sanitized text to clipboard so user can instantly paste
   * if the desktop URL handler misbehaves or collapses linebreaks.
   */
  const handleOpenWhatsApp = async (
    phone?: string | null,
    memberId?: string | null,
    useWeb = false
  ) => {
    const clean = sanitizeWhatsAppText(messageText);
    if (clean !== messageText) setMessageText(clean);

    // Auto-copy clean message to clipboard as foolproof fallback
    try {
      await navigator.clipboard.writeText(clean);
    } catch {
      /* clipboard write may fail if document focus lost */
    }

    const link = useWeb ? waWebLink(clean, phone) : waLink(clean, phone);
    window.open(link, "_blank");

    const channel = phone ? "whatsapp_individual" : "whatsapp_group";
    await logShareEvent(channel, memberId);

    toast.success(
      useWeb
        ? "WhatsApp Web opened! Clean message copied to clipboard."
        : "WhatsApp opened! Clean message copied to clipboard (press Ctrl+V if app skips newlines)."
    );
  };

  const handleCopyClean = async () => {
    try {
      const clean = sanitizeWhatsAppText(messageText);
      if (clean !== messageText) setMessageText(clean);
      await navigator.clipboard.writeText(clean);
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 2500);
      await logShareEvent("copy");
      toast.success("✓ Clean message copied! Paste directly into WhatsApp group.");
    } catch {
      toast.error("Failed to copy message");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      toast.success("Student checklist link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const clean = sanitizeWhatsAppText(messageText);
        await navigator.share({
          title: taskList.title,
          text: clean,
          url: publicLink,
        });
        await logShareEvent("native_share");
        toast.success("Shared via device!");
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyClean();
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
          <Share2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Dispatch to WhatsApp</span>
        </div>
      }
      description={`Share "${taskList.title}" with ${taskList.group_name}`}
      footer={
        <div className="w-full space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="whatsapp"
              size="lg"
              onClick={() => handleOpenWhatsApp(targetPhone, undefined, false)}
              disabled={urlStats.isExceeded}
              className="w-full text-xs sm:text-sm font-bold py-2.5 flex items-center justify-center gap-2 shadow-sm"
            >
              <WhatsAppIcon className="w-4 h-4 mr-1 shrink-0" />
              {sendTarget === "saved_number" && defaultWaPhone
                ? `WhatsApp (+${defaultWaPhone})`
                : "Open WhatsApp"}
            </Button>

            <Button
              type="button"
              variant={copiedClean ? "primary" : "outline"}
              size="lg"
              onClick={handleCopyClean}
              className={`w-full text-xs sm:text-sm font-bold py-2.5 flex items-center justify-center gap-2 ${
                copiedClean ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""
              }`}
            >
              {copiedClean ? (
                <>
                  <Check className="w-4 h-4 mr-1.5 text-white" />
                  Copied Clean!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copy Clean Message
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleOpenWhatsApp(targetPhone, undefined, true)}
              className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
            >
              <Globe className="w-3.5 h-3.5" /> Open WhatsApp Web
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="text-[var(--color-primary)] hover:underline flex items-center gap-1 font-semibold text-[11px]"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Copy Link Only
            </button>

            <button
              type="button"
              onClick={handleManualMarkSent}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 text-[11px]"
            >
              {markedSent ? (
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Mark Sent
                </span>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 pt-0.5">
        {/* Mobile Phone Accessibility Callout */}
        {isLocalhostLink ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950 dark:text-amber-100">
                  <span>Make Link Accessible to Students</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-extrabold">
                    Action Needed
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90 leading-snug mt-0.5">
                  Your link uses <code>localhost</code>. Students on mobile phones cannot open localhost.
                </p>
              </div>
            </div>
            {detectedWifiUrl ? (
              <Button
                type="button"
                size="sm"
                onClick={() => handleApplyBaseUrl(detectedWifiUrl)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0 text-xs shadow-xs w-full sm:w-auto flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                Switch to Wi-Fi ({detectedIp})
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowHostConfig(true)}
                className="text-xs shrink-0 w-full sm:w-auto"
              >
                Set Mobile Host
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl">
            <div className="flex items-center gap-2 truncate">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] truncate">
                Mobile Link Ready: <code className="font-mono font-bold text-emerald-950 dark:text-emerald-100">{publicLink}</code>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowHostConfig(!showHostConfig)}
              className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
            >
              {showHostConfig ? "Hide Config" : "Change Host"}
            </button>
          </div>
        )}

        {isAssignment && activeTab === "share" && (
          <div className="p-3.5 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/25 text-xs text-[var(--color-primary-text)] space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />
              Checklist ready to notify group
            </p>
            <p className="text-[11px] leading-relaxed opacity-90">
              Pick your class group and send. Students receive the tasks, due date, and interactive checklist link with zero formatting glitches.
            </p>
          </div>
        )}

        {/* Share vs Reminder Mode Switch */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-3">
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
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors capitalize ${
                    reminderType === r
                      ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-xs"
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
                      {pendingForMember > 0 ? ` — ${pendingForMember} pending` : ""}
                    </option>
                  );
                })}
            </select>
          </div>
        )}

        {/* Gemini AI Reminder Assistant */}
        {activeTab === "reminder" && (
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Gemini AI Reminder Assistant</span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAiDraftReminder}
                disabled={isDraftingAi}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs h-7 px-2.5 shadow-sm"
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
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-emerald-200/60 dark:border-emerald-900/40"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setAiLang("hi")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    aiLang === "hi"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-emerald-200/60 dark:border-emerald-900/40"
                  }`}
                >
                  हिंदी
                </button>
                <button
                  type="button"
                  onClick={() => setAiLang("mr")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    aiLang === "mr"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-emerald-200/60 dark:border-emerald-900/40"
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
                  className="px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[11px] font-medium focus:outline-none"
                >
                  <option value="polite">Polite &amp; Encouraging</option>
                  <option value="urgent">Urgent (Overdue)</option>
                  <option value="firm">Firm &amp; Direct</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* View Switcher: WhatsApp Live Bubble vs Raw Textarea & Format Switcher */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-1 rounded-xl border border-[var(--color-border-primary)]">
                <button
                  type="button"
                  onClick={() => setPreviewView("bubble")}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ${
                    previewView === "bubble"
                      ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewView("raw")}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ${
                    previewView === "raw"
                      ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  <span>Edit Text</span>
                </button>
              </div>

              {/* Format Style Switcher: Numbered vs Bullets */}
              <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-1 rounded-xl border border-[var(--color-border-primary)]">
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] px-1.5">Format:</span>
                <button
                  type="button"
                  onClick={() => setMessageStyle("numbered")}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                    messageStyle === "numbered"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  1. 2. 3. Numbered
                </button>
                <button
                  type="button"
                  onClick={() => setMessageStyle("bullets")}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                    messageStyle === "bullets"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  - Bullets
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-tertiary)] text-[11px]">
                {messageText.length} chars
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  urlStats.isExceeded
                    ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                    : urlStats.isWarning
                    ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-text-tertiary)]"
                }`}
              >
                URL: {urlStats.length} / 2048
              </span>
            </div>
          </div>

          {/* Conditional rendering based on preview tab */}
          {previewView === "bubble" ? (
            <WhatsAppBubblePreview
              text={messageText}
              groupName={taskList.group_name}
              onCopy={handleCopyClean}
              copied={copiedClean}
            />
          ) : (
            <div className="space-y-2">
              {messageTemplates.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-[var(--color-text-tertiary)] shrink-0">Template:</span>
                  <select
                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-[var(--color-border-input)] bg-[var(--color-surface)] text-xs text-[var(--color-text-primary)]"
                    defaultValue=""
                    onChange={(e) => {
                      const tpl = messageTemplates.find((t) => t.id === e.target.value);
                      if (tpl?.body?.text) {
                        const filled = tpl.body.text
                          .replace(/\{\{title\}\}/gi, taskList.title)
                          .replace(/\{\{group\}\}/gi, taskList.group_name)
                          .replace(/\{\{link\}\}/gi, publicLink);
                        setMessageText(sanitizeWhatsAppText(filled));
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
              <textarea
                rows={7}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-input)] text-[var(--color-text-primary)] font-mono text-xs p-3.5 focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-primary-subtle)] leading-relaxed resize-none"
              />
            </div>
          )}

          {urlStats.isExceeded && (
            <p className="text-xs text-[var(--color-danger)] flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              URL length exceeds 2048 characters. Shorten title or items before dispatching.
            </p>
          )}
        </div>

        {/* Mobile Network Link / Wi-Fi IP Helper */}
        <div className="p-3.5 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-primary)] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)]">
              <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mobile Phone Access &amp; Link Host</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHostConfig(!showHostConfig)}
              className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
            >
              {showHostConfig ? "Hide Config" : "Change Host / IP"}
            </button>
          </div>

          <div className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            {isLocalhostLink ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Link uses <code>localhost</code>. Students on mobile phones cannot open localhost.
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Member link: <code className="font-mono text-[10px] ml-1">{publicLink}</code>
              </span>
            )}
          </div>

          {showHostConfig && (
            <div className="pt-2.5 border-t border-[var(--color-border-secondary)] space-y-3">
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                Pick the link address included in your WhatsApp message so mobile phones can connect:
              </p>

              {/* 1-Tap Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider block">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {detectedWifiUrl && (
                    <button
                      type="button"
                      onClick={() => handleApplyBaseUrl(detectedWifiUrl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        effectiveBaseUrl === detectedWifiUrl
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-[var(--color-surface)] border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      }`}
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      📶 Wi-Fi IP ({detectedIp})
                    </button>
                  )}

                  {networkInterfaces
                    .filter((ni) => ni.ip !== detectedIp)
                    .map((ni) => (
                      <button
                        key={ni.ip}
                        type="button"
                        onClick={() => handleApplyBaseUrl(ni.url)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${
                          effectiveBaseUrl === ni.url ? "border-emerald-500 font-bold" : ""
                        }`}
                      >
                        {ni.name}: {ni.ip}
                      </button>
                    ))}

                  <button
                    type="button"
                    onClick={() => handleApplyBaseUrl("http://localhost:3000")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${
                      effectiveBaseUrl === "http://localhost:3000" ? "border-amber-500 font-bold" : ""
                    }`}
                  >
                    💻 Localhost (This PC only)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        handleApplyBaseUrl(window.location.origin);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${
                      typeof window !== "undefined" && effectiveBaseUrl === window.location.origin
                        ? "border-emerald-500 font-bold"
                        : ""
                    }`}
                  >
                    🌐 Browser Origin
                  </button>
                </div>
              </div>

              {/* Custom Domain or Tunnel URL input */}
              <div className="space-y-1.5 pt-1 border-t border-[var(--color-border-secondary)]">
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  Or enter public domain / tunnel URL (For sharing outside local Wi-Fi):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    placeholder="https://tasks.yourlab.org or http://192.168.X.X:3000"
                    className="flex-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-input)] px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => handleApplyBaseUrl(customHost)}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">
                  💡 <strong>Same Wi-Fi (Lab / Classroom):</strong> Choose your Wi-Fi IP (e.g. <code>http://192.168.0.105:3000</code>). Students connected to the same Wi-Fi can open it immediately.<br />
                  🌐 <strong>Outside Wi-Fi:</strong> Enter your public domain, Vercel URL, or free tunnel URL (e.g. Cloudflare / ngrok).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Where to send */}
        <div className="space-y-2 p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-primary)]">
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">
            Where should this go?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSendTarget("pick_chat")}
              className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                sendTarget === "pick_chat"
                  ? "border-[var(--color-whatsapp)] bg-[var(--color-whatsapp-bg)] text-[var(--color-text-primary)]"
                  : "border-[var(--color-border-primary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)]"
              }`}
            >
              <span className="font-semibold block">WhatsApp group / any chat</span>
              <span className="text-[11px] text-[var(--color-text-tertiary)] leading-snug block mt-0.5">
                Opens WhatsApp — you pick the group you&apos;re in (recommended)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSendTarget("saved_number")}
              disabled={!defaultWaPhone}
              className={`text-left p-2.5 rounded-lg border text-xs transition-all disabled:opacity-45 disabled:cursor-not-allowed ${
                sendTarget === "saved_number"
                  ? "border-[var(--color-whatsapp)] bg-[var(--color-whatsapp-bg)] text-[var(--color-text-primary)]"
                  : "border-[var(--color-border-primary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)]"
              }`}
            >
              <span className="font-semibold block">
                Saved personal number
                {defaultWaPhone ? ` (+${defaultWaPhone})` : ""}
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)] leading-snug block mt-0.5">
                {defaultWaPhone
                  ? "1:1 chat only — not a group. Change under Settings."
                  : "Optional — set a number in Settings for personal testing."}
              </span>
            </button>
          </div>
        </div>

        {/* Pro-Tip Reassurance Banner */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-[var(--color-text-secondary)] flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[var(--color-text-primary)]">Pro Tip:</strong> When you tap <em className="font-semibold text-emerald-700 dark:text-emerald-400">Open WhatsApp</em>, we automatically copy the formatted checklist to your clipboard. If Windows WhatsApp Desktop strips linebreaks in its text preview, just press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">Ctrl+V</kbd> to paste the clean multi-line checklist with zero glitches!
          </p>
        </div>

        {/* Direct Individual Member Links if available */}
        {members.length > 0 && (
          <div className="pt-2 border-t border-[var(--color-border-secondary)] space-y-2">
            <span className="text-xs font-semibold text-[var(--color-text-tertiary)] block">
              Or message one student ({members.filter((m) => m.phone).length} with phones)
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[var(--color-surface-sunken)] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
                    <span className="font-semibold text-[var(--color-text-primary)] truncate">
                      {member.name}
                    </span>
                    {member.phone && (
                      <span className="text-[var(--color-text-tertiary)] text-[11px] shrink-0">
                        ({member.phone})
                      </span>
                    )}
                  </div>
                  {member.phone ? (
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(member.phone, member.id, false)}
                      className="text-[var(--color-primary)] hover:underline font-semibold flex items-center gap-1 text-[11px] shrink-0"
                    >
                      <Send className="w-3 h-3" /> WhatsApp
                    </button>
                  ) : (
                    <span className="text-[var(--color-text-disabled)] text-[10px]">No phone</span>
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
