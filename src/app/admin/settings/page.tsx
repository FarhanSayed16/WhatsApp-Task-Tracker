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
import {
  KeyRound,
  User,
  Clock,
  Download,
  Smartphone,
  CheckCircle2,
  Database,
  ShieldAlert,
  Save,
  Activity,
  Layers,
  Users,
  FileSpreadsheet,
  Mail,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { toast } = useToast();

  // Settings profile fetch
  const {
    data: profileData,
    isLoading: isProfileLoading,
    mutate: mutateProfile,
  } = useSWRFetch<any>("/api/admin/settings", { disablePoll: true });

  // System Health fetch
  const { data: healthData } = useSWRFetch<any>("/api/health", {
    pollInterval: 30000,
  });

  // PIN Form State
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Profile Form State
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [profileSaving, setProfileSaving] = useState(false);

  // Email Digest State
  const [digestFreq, setDigestFreq] = useState<"off" | "daily" | "weekly" | "monthly">("off");
  const [digestRecipients, setDigestRecipients] = useState("");
  const [digestDay, setDigestDay] = useState(1);
  const [digestSaving, setDigestSaving] = useState(false);
  const [isTestingDigest, setIsTestingDigest] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (profileData) {
      setName(profileData.name || "");
      setTimezone(profileData.timezone || "Asia/Kolkata");
      if (profileData.report_digest) {
        setDigestFreq(profileData.report_digest.frequency || "off");
        setDigestRecipients((profileData.report_digest.recipients || []).join(", "));
        setDigestDay(profileData.report_digest.day_of_week ?? 1);
      }
    }
  }, [profileData]);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info(
        "To install, tap the Share or Menu icon in your browser and select 'Add to Home Screen'."
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      toast.success("Task Tracker installed to home screen!");
    }
    setDeferredPrompt(null);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (oldPin.length !== 6 || newPin.length !== 6) {
      toast.error("Both current and new PIN must be exactly 6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      toast.error("New PIN and Confirm PIN do not match.");
      return;
    }

    try {
      setPinLoading(true);
      const res = await fetch("/api/admin/settings/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_pin: oldPin, new_pin: newPin }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to update PIN");
      }

      toast.success(
        "PIN updated successfully! Active sessions on other devices have been revoked."
      );
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change PIN");
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
        body: JSON.stringify({ name, timezone }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to save preferences");
      }

      toast.success("Profile preferences saved successfully");
      mutateProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to save preferences");
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

      toast.success("Email digest preferences saved successfully");
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

  return (
    <AdminLayout
      title="Settings & System"
      subtitle="Manage security PIN, preferences, PWA install, and CSV backups"
    >
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* System Health Banner */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  System Status
                </span>
                <Badge
                  variant={healthData?.db === "connected" ? "verified" : "overdue"}
                  className="text-[10px] uppercase font-bold"
                >
                  {healthData?.db === "connected" ? "Operational" : "Degraded"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Supabase Postgres (Mumbai) · Version {healthData?.version || "0.1.0"}
              </p>
            </div>
          </div>

          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Health Ping →
          </a>
        </div>

        {/* Security & PIN Section */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Security & Access PIN
              </h2>
              <p className="text-xs text-slate-500">
                Change your 6-digit access PIN. Updating your PIN bumps the session version and invalidates all other devices.
              </p>
            </div>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm New PIN
                </label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={pinLoading || oldPin.length !== 6 || newPin.length !== 6}
              className="mt-2"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {pinLoading ? "Updating PIN..." : "Update PIN"}
            </Button>
          </form>
        </section>

        {/* Profile & Preferences Section */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Admin Profile & Preferences
              </h2>
              <p className="text-xs text-slate-500">
                Personalize your greeting name and operational timezone.
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Language Preference
                </label>
                <p className="text-xs text-slate-500 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  English (Default)
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={profileSaving}
                className="mt-2"
              >
                <Save className="w-4 h-4 mr-2" />
                {profileSaving ? "Saving..." : "Save Preferences"}
              </Button>
            </form>
          )}
        </section>

        {/* Automated Email Digests Section (Phase 13.5) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Automated Email Digest
              </h2>
              <p className="text-xs text-slate-500">
                Receive periodic email summaries of completion rates, top performers, and overdue tasks.
              </p>
            </div>
          </div>

          <form onSubmit={handleDigestSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Digest Frequency
              </label>
              <select
                value={digestFreq}
                onChange={(e) => setDigestFreq(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="off">Off (Disabled)</option>
                <option value="daily">Daily (Every morning at 8:30 AM IST)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly (1st of each month)</option>
              </select>
            </div>

            {digestFreq === "weekly" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Send on Day
                </label>
                <select
                  value={digestDay}
                  onChange={(e) => setDigestDay(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Recipient Email(s)
                </label>
                <input
                  type="text"
                  placeholder="professor@university.edu, admin@college.edu"
                  value={digestRecipients}
                  onChange={(e) => setDigestRecipients(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Separate multiple recipients with commas. Requires RESEND_API_KEY environment variable.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={digestSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {digestSaving ? "Saving..." : "Save Digest Schedule"}
              </Button>

              {digestFreq !== "off" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestDigestClick}
                  disabled={isTestingDigest}
                >
                  <Mail className="w-4 h-4 mr-2 text-purple-600" />
                  {isTestingDigest ? "Sending Test..." : "Send Test Digest Now"}
                </Button>
              )}
            </div>
          </form>
        </section>

        {/* PWA & Mobile Installation Section */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Mobile App & PWA
              </h2>
              <p className="text-xs text-slate-500">
                Install Task Tracker directly onto your smartphone home screen without using an app store.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  Home Screen Install
                </span>
                {isInstalled ? (
                  <Badge variant="verified" className="text-[10px]">
                    Installed
                  </Badge>
                ) : (
                  <Badge variant="pending" className="text-[10px]">
                    Available
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                Fast standalone launch, offline caching, and responsive full-screen experience.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleInstallClick}
              disabled={isInstalled}
              className="shrink-0"
            >
              <Smartphone className="w-4 h-4 mr-1.5" />
              {isInstalled ? "App Installed" : "Install App"}
            </Button>
          </div>
        </section>

        {/* Data Export & Backup Section */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Data Storage & CSV Backup
              </h2>
              <p className="text-xs text-slate-500">
                Download offline backups of your checklists, member rosters, and completion records.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
              <Users className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="text-xs text-slate-500 block">Total Groups</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {stats.total_groups}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
              <Layers className="w-5 h-5 text-blue-600" />
              <div>
                <span className="text-xs text-slate-500 block">Task Lists</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {stats.total_lists}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <span className="text-xs text-slate-500 block">Total Students</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {stats.total_members}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href="/api/admin/export"
              download
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Full CSV Backup
            </a>

            <span className="text-xs text-slate-500">
              Includes full audit log, timestamps, notes, and verify statuses.
            </span>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
