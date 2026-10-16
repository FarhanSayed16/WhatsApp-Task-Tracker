"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSWRFetch } from "@/hooks/useSWRFetch";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { usePWAInstall } from "@/components/ui/PWAInstallPrompt";
import {
  KeyRound,
  User,
  Clock,
  Download,
  Smartphone,
  CheckCircle2,
  Database,
  Save,
  Activity,
  Layers,
  Users,
  FileSpreadsheet,
  Mail,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { toast } = useToast();

  // Settings profile fetch
  const {
    data: profileData,
    isLoading: isProfileLoading,
    mutate: mutateProfile,
  } = useSWRFetch<any>("/api/admin/settings", { disablePoll: true });

  // System Health fetch (polled discreetly)
  const { data: healthData } = useSWRFetch<any>("/api/health", {
    pollInterval: 60000,
  });

  // PIN Form State
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Profile Form State
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [defaultWaPhone, setDefaultWaPhone] = useState("919324826414");
  const [profileSaving, setProfileSaving] = useState(false);

  // Email Digest State
  const [digestFreq, setDigestFreq] = useState<"off" | "daily" | "weekly" | "monthly">("off");
  const [digestRecipients, setDigestRecipients] = useState("");
  const [digestDay, setDigestDay] = useState(1);
  const [digestSaving, setDigestSaving] = useState(false);
  const [isTestingDigest, setIsTestingDigest] = useState(false);

  // PWA Install State from shared hook
  const { isInstalled, isIOS, promptInstall } = usePWAInstall();

  useEffect(() => {
    if (profileData) {
      setName(profileData.name || "");
      setTimezone(profileData.timezone || "Asia/Kolkata");
      setDefaultWaPhone(profileData.default_wa_phone || "919324826414");
      if (profileData.report_digest) {
        setDigestFreq(profileData.report_digest.frequency || "off");
        setDigestRecipients((profileData.report_digest.recipients || []).join(", "));
        setDigestDay(profileData.report_digest.day_of_week ?? 1);
      }
    }
  }, [profileData]);

  const handleInstallClick = async () => {
    if (isIOS) {
      toast.info(
        "To install on iOS: Tap Share at bottom of Safari and select 'Add to Home Screen'."
      );
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast.success("TaskTracker added to home screen!");
    } else {
      toast.info(
        "To install, tap Share (or menu) in your browser and select 'Add to Home Screen'."
      );
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 6 || oldPin.length !== 6) {
      toast.error("Both PINs must be exactly 6 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PIN and confirmation do not match");
      return;
    }

    try {
      setPinLoading(true);
      const res = await fetch("/api/admin/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_pin: oldPin, new_pin: newPin }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to update PIN");
      }

      toast.success("Security PIN updated successfully");
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      setShowPinChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update PIN");
    } finally {
      setPinLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          timezone,
          default_wa_phone: defaultWaPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to save profile");
      }

      toast.success("Profile preferences saved");
      mutateProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDigestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDigestSaving(true);
      const emails = digestRecipients
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (digestFreq !== "off" && emails.length === 0) {
        toast.error("Please provide at least one recipient email address");
        setDigestSaving(false);
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_digest: {
            frequency: digestFreq,
            recipients: emails,
            day_of_week: Number(digestDay),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to save digest settings");
      }

      toast.success("Email digest preferences saved");
      mutateProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to save digest preferences");
    } finally {
      setDigestSaving(false);
    }
  };

  const handleTestDigestClick = async () => {
    try {
      setIsTestingDigest(true);
      const emails = digestRecipients
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (emails.length === 0) {
        toast.error("Please add at least one recipient email address");
        return;
      }

      const res = await fetch("/api/admin/reports/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: emails }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to send test digest");
      }

      toast.success(`Test digest sent to ${emails.join(", ")}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send test digest");
    } finally {
      setIsTestingDigest(false);
    }
  };

  const stats = profileData?.stats || {
    total_groups: 0,
    total_lists: 0,
    total_members: 0,
  };

  const handleExportBackup = async () => {
    try {
      setExportingCsv(true);
      const res = await fetch("/api/admin/export");
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || contentType.includes("application/json")) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Export failed — check you are logged in");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV backup downloaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export backup");
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <AdminLayout
      title="Settings"
      subtitle="Manage your profile, security PIN, notifications, and data backups"
    >
      <div className="max-w-3xl space-y-6 pb-12">
        {/* 1. Profile & Preferences */}
        <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-primary)] p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border-secondary)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Profile & Preferences
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Personalize your greeting name, operational timezone, and WhatsApp phone.
              </p>
            </div>
          </div>

          {isProfileLoading ? (
            <div className="space-y-4 max-w-md">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Professor / Admin Name
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Professor Sharma"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST - UTC+4:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+8:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Default WhatsApp number (for test sharing)
                </label>
                <Input
                  type="tel"
                  value={defaultWaPhone}
                  onChange={(e) => setDefaultWaPhone(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="919324826414"
                />
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5 leading-relaxed">
                  Used when you tap <strong>Open WhatsApp</strong> on a share sheet — opens a chat with the checklist message and link.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={profileSaving}
                className="mt-2"
                size="sm"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {profileSaving ? "Saving…" : "Save Preferences"}
              </Button>
            </form>
          )}
        </section>

        {/* 2. Security: Change PIN (Collapsible) */}
        <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-primary)] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-secondary)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Security & Access PIN
                </h2>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  6-digit passcode used to sign in on your devices.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPinChange(!showPinChange)}
            >
              {showPinChange ? "Cancel" : "Change PIN"}
              {showPinChange ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </Button>
          </div>

          {showPinChange && (
            <form onSubmit={handlePinSubmit} className="space-y-4 max-w-md pt-2">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Current 6-Digit PIN
                </label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/[^0-9]/g, ""))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    New 6-Digit PIN
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Confirm New PIN
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={pinLoading || oldPin.length !== 6 || newPin.length !== 6}
                className="mt-2"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                {pinLoading ? "Updating…" : "Save New PIN"}
              </Button>
            </form>
          )}
        </section>

        {/* 3. Notifications: Email Digest */}
        <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-primary)] p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border-secondary)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Email Digest Notifications
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Receive scheduled email summaries of completion rates and overdue tasks.
              </p>
            </div>
          </div>

          <form onSubmit={handleDigestSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Frequency
              </label>
              <select
                value={digestFreq}
                onChange={(e) => setDigestFreq(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="off">Off (Disabled)</option>
                <option value="daily">Daily (Morning at 8:30 AM IST)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly (1st of each month)</option>
              </select>
            </div>

            {digestFreq === "weekly" && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Send on Day
                </label>
                <select
                  value={digestDay}
                  onChange={(e) => setDigestDay(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={0}>Sunday</option>
                </select>
              </div>
            )}

            {digestFreq !== "off" && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Recipient Email(s)
                </label>
                <input
                  type="text"
                  placeholder="professor@university.edu, lab@college.edu"
                  value={digestRecipients}
                  onChange={(e) => setDigestRecipients(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-input)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                  Separate multiple recipients with commas.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={digestSaving}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {digestSaving ? "Saving…" : "Save Digest Schedule"}
              </Button>

              {digestFreq !== "off" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestDigestClick}
                  disabled={isTestingDigest}
                >
                  <Mail className="w-3.5 h-3.5 mr-1.5 text-[var(--color-primary)]" />
                  {isTestingDigest ? "Sending…" : "Send Test Digest Now"}
                </Button>
              )}
            </div>
          </form>
        </section>

        {/* 4. Data Storage & CSV Backup */}
        <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-primary)] p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border-secondary)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Data Storage & Offline Backup
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Download full data backups of checklists, groups, and student submissions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)]">
              <span className="text-[11px] text-[var(--color-text-tertiary)] block">Groups</span>
              <span className="text-base font-bold text-[var(--color-text-primary)]">
                {stats.total_groups}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)]">
              <span className="text-[11px] text-[var(--color-text-tertiary)] block">Lists</span>
              <span className="text-base font-bold text-[var(--color-text-primary)]">
                {stats.total_lists}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)]">
              <span className="text-[11px] text-[var(--color-text-tertiary)] block">Students</span>
              <span className="text-base font-bold text-[var(--color-text-primary)]">
                {stats.total_members}
              </span>
            </div>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportBackup}
              disabled={exportingCsv}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-[var(--color-primary)]" />
              {exportingCsv ? "Preparing backup…" : "Download Full CSV Backup"}
            </Button>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Complete historical archive including timestamps and verify notes.
            </span>
          </div>
        </section>

        {/* 5. Mobile App & PWA */}
        <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-primary)] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Mobile App & PWA
                </h2>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Install TaskTracker to your home screen for instant full-screen access.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInstallClick}
              disabled={isInstalled}
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              {isInstalled ? "App Installed" : "Install App"}
            </Button>
          </div>
        </section>

        {/* 6. About & System Health (Discreet footer) */}
        <div className="p-4 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-surface-sunken)]/60 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <div className="flex items-center gap-2">
            <Logo size="xs" />
            <span className="font-semibold text-[var(--color-text-secondary)]">TaskTracker</span>
            <span>v{healthData?.version || "1.0.0"}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                healthData?.db === "connected" ? "bg-[var(--color-status-verified)]" : "bg-[var(--color-status-overdue)]"
              )} />
              {healthData?.db === "connected" ? "Database Connected" : "Connecting…"}
            </span>
          </div>

          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-[var(--color-primary-text)] hover:underline"
          >
            Health Ping →
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
