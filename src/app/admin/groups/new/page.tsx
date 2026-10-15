"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, UserPlus, FileText, Trash2, ShieldCheck, Check } from "lucide-react";

interface MemberDraft {
  name: string;
  phone?: string;
}

export default function NewGroupPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [verifyRequired, setVerifyRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Members draft state
  const [activeTab, setActiveTab] = useState("manual");
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberInputError, setMemberInputError] = useState("");
  const [csvText, setCsvText] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberInputError("");

    const trimmedName = memberName.trim();
    if (!trimmedName) {
      setMemberInputError("Member name is required");
      return;
    }

    if (members.some((m) => m.name.toLowerCase() === trimmedName.toLowerCase())) {
      setMemberInputError("Member with this name is already in the list");
      return;
    }

    let cleanPhone: string | undefined = undefined;
    if (memberPhone.trim()) {
      cleanPhone = memberPhone.replace(/\D/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        setMemberInputError("Phone must be 10-15 digits");
        return;
      }
    }

    setMembers([...members, { name: trimmedName, phone: cleanPhone }]);
    setMemberName("");
    setMemberPhone("");
  };

  const handleParseCsv = () => {
    if (!csvText.trim()) return;

    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const newMembers: MemberDraft[] = [];
    const seen = new Set(members.map((m) => m.name.toLowerCase()));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line.toLowerCase().startsWith("name")) continue;

      const parts = line.split(",").map((p) => p.replace(/^["']|["']$/g, "").trim());
      const rawName = parts[0];
      const rawPhone = parts[1] || "";

      if (!rawName) continue;
      const lower = rawName.toLowerCase();
      if (seen.has(lower)) continue;

      seen.add(lower);
      let phone: string | undefined = undefined;
      if (rawPhone) {
        const digits = rawPhone.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15) {
          phone = digits;
        }
      }

      newMembers.push({ name: rawName, phone });
    }

    if (newMembers.length > 0) {
      setMembers([...members, ...newMembers]);
      setCsvText("");
      toast.success(`Added ${newMembers.length} members from CSV`);
    } else {
      toast.info("No new members found to import");
    }
  };

  const handleRemoveMember = (indexToRemove: number) => {
    setMembers(members.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!name.trim()) {
      setErrors({ name: "Group name is required" });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          verify_required: verifyRequired,
          members: members.map((m) => ({
            name: m.name,
            phone: m.phone || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data?.error?.message || "Failed to create group");
      }

      toast.success("Group created successfully!");
      router.push(`/admin/groups/${data.data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create group");
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Create New Group"
      subtitle="Define group details and add initial members"
      actions={
        <Link href="/admin/groups">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Groups
          </Button>
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Details Card */}
          <Card className="p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              1. Group Details
            </h2>

            <Input
              label="Group Name"
              placeholder="e.g. CS201 Lab Batch A, Research Assistants"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Brief purpose of this group or schedule notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm p-3.5 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              />
            </div>

            {/* Verification Setting */}
            <div
              onClick={() => setVerifyRequired(!verifyRequired)}
              className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 cursor-pointer select-none transition-colors hover:border-emerald-500/30"
            >
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  verifyRequired
                    ? "bg-emerald-600 text-white"
                    : "border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                }`}
              >
                {verifyRequired && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Require Professor Verification
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  When enabled, member ticks mark items as &quot;Done&quot;, and you confirm them as &quot;Verified&quot;.
                  If disabled, member ticks immediately mark items as verified.
                </p>
              </div>
            </div>
          </Card>

          {/* Members Roster Card */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Member Roster
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {members.length} member{members.length === 1 ? "" : "s"} added
                </p>
              </div>

              <Tabs
                tabs={[
                  { id: "manual", label: "Add One by One", icon: <UserPlus className="w-3.5 h-3.5" /> },
                  { id: "csv", label: "Paste CSV", icon: <FileText className="w-3.5 h-3.5" /> },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            </div>

            {/* Manual entry tab */}
            {activeTab === "manual" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Member Name (e.g. Alex Smith)"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                  />
                  <Input
                    placeholder="Phone (optional, 10-15 digits)"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                  />
                </div>
                {memberInputError && (
                  <p className="text-xs text-rose-500 font-medium">
                    {memberInputError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddMember}
                  className="w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" /> Add Member
                </Button>
              </div>
            )}

            {/* CSV Paste tab */}
            {activeTab === "csv" && (
              <div className="space-y-3">
                <textarea
                  rows={4}
                  placeholder={`Paste names (or name,phone per line):\nAlex Smith,9876543210\nSarah Jenkins,9876543211\nMichael Scott`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs font-mono p-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleParseCsv}
                  disabled={!csvText.trim()}
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Parse &amp; Add Members
                </Button>
              </div>
            )}

            {/* Added members list preview */}
            {members.length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Roster Preview ({members.length}):
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1">
                  {members.map((member, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {member.name}
                        </span>
                        {member.phone && (
                          <span className="text-slate-400">({member.phone})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded"
                        aria-label={`Remove ${member.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No members added yet. You can also add members anytime later.
              </div>
            )}
          </Card>

          {errors.form && (
            <p className="text-xs text-rose-500 font-semibold">{errors.form}</p>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/admin/groups">
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={loading}>
              Create Group
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
