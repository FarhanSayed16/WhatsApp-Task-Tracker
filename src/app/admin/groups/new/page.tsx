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

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, idx) => idx !== index));
  };

  const handleParseCsv = () => {
    setMemberInputError("");
    if (!csvText.trim()) return;

    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsed: MemberDraft[] = [];
    const seenNames = new Set(members.map((m) => m.name.toLowerCase()));

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      const namePart = parts[0];
      const phonePart = parts[1] ? parts[1].replace(/\D/g, "") : undefined;

      if (!namePart) continue;
      if (seenNames.has(namePart.toLowerCase())) continue;

      seenNames.add(namePart.toLowerCase());
      parsed.push({
        name: namePart,
        phone: phonePart && phonePart.length >= 10 ? phonePart : undefined,
      });
    }

    if (parsed.length === 0) {
      setMemberInputError("No valid or new members found in CSV paste");
      return;
    }

    setMembers([...members, ...parsed]);
    setCsvText("");
    toast.success(`Parsed & added ${parsed.length} members`);
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
          description: description.trim() || undefined,
          verify_required: verifyRequired,
          members: members.map((m) => ({
            name: m.name,
            phone: m.phone || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json?.error?.message || "Failed to create group");
      }

      toast.success("Group created successfully");
      router.push(`/admin/groups/${json.data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create group");
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Create Group"
      subtitle="Define a student cohort, research lab, or staff roster"
      actions={
        <Link href="/admin/groups">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Groups
          </Button>
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Details Card */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-secondary)] pb-2.5">
              Group Details
            </h2>

            <Input
              label="Group Name"
              placeholder="e.g. MSc Chemistry 2026 or Lab Batch A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Brief purpose of this group or schedule notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] text-xs p-3 focus:outline-none focus:border-[var(--color-primary)] transition-all resize-none"
              />
            </div>

            {/* Verification Setting */}
            <div
              onClick={() => setVerifyRequired(!verifyRequired)}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-surface-sunken)] cursor-pointer select-none transition-colors hover:border-[var(--color-primary)]/40"
            >
              <div
                className={`w-4.5 h-4.5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  verifyRequired
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border-input)] bg-[var(--color-surface)]"
                }`}
              >
                {verifyRequired && <Check className="w-3 h-3" />}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Require Professor Verification
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                  When enabled, member ticks mark items as &quot;Done&quot;, and you confirm them as &quot;Verified&quot;.
                  If disabled, ticks immediately verify the item.
                </p>
              </div>
            </div>
          </Card>

          {/* Members Roster Card */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-2.5">
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Member Roster
                </h2>
                <p className="text-xs text-[var(--color-text-tertiary)]">
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
                  <p className="text-xs text-[var(--color-danger)] font-medium">
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
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Member
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
                  className="w-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] text-xs font-mono p-3 focus:outline-none focus:border-[var(--color-primary)] resize-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleParseCsv}
                  disabled={!csvText.trim()}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Parse &amp; Add Members
                </Button>
              </div>
            )}

            {/* Added members list preview */}
            {members.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Roster Preview ({members.length}):
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1 p-1">
                  {members.map((member, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4.5 h-4.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {member.name}
                        </span>
                        {member.phone && (
                          <span className="text-[var(--color-text-tertiary)]">({member.phone})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] p-1 rounded"
                        aria-label={`Remove ${member.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-[var(--color-border-primary)] text-center text-xs text-[var(--color-text-tertiary)]">
                No members added yet. You can also add members anytime later.
              </div>
            )}
          </Card>

          {errors.form && (
            <p className="text-xs text-[var(--color-danger)] font-semibold">{errors.form}</p>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/admin/groups">
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" loading={loading}>
              Create Group
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
