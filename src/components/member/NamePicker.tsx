"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Member } from "@/types";
import { User, RefreshCw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface NamePickerProps {
  members: Member[];
  selectedMemberId: string | null;
  selectedMember?: Member | null;
  onSelectMember: (member: Member | null) => void;
  onJoinName?: (name: string) => Promise<Member>;
  disabled?: boolean;
}

export function NamePicker({
  members,
  selectedMemberId,
  selectedMember,
  onSelectMember,
  onJoinName,
  disabled = false,
}: NamePickerProps) {
  const [hasInitialized, setHasInitialized] = useState(false);
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitialized) return;

    try {
      const storedMemberId = localStorage.getItem("wtt_member_id");
      if (storedMemberId) {
        const found = members.find((m) => m.id === storedMemberId && m.active !== false);
        if (found) {
          onSelectMember(found);
        }
      }
    } catch {
      // localStorage may not be available
    } finally {
      setHasInitialized(true);
    }
  }, [members, onSelectMember, hasInitialized]);

  const currentMember =
    members.find((m) => m.id === selectedMemberId) ||
    (selectedMember?.id === selectedMemberId ? selectedMember : null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, query]);

  const handleSelect = (member: Member) => {
    try {
      localStorage.setItem("wtt_member_id", member.id);
      localStorage.setItem("wtt_member_name", member.name);
    } catch {
      // Ignore
    }
    setJoinError(null);
    onSelectMember(member);
  };

  const handleClear = () => {
    try {
      localStorage.removeItem("wtt_member_id");
      localStorage.removeItem("wtt_member_name");
    } catch {
      // Ignore
    }
    onSelectMember(null);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onJoinName || joining) return;
    const name = customName.trim();
    if (name.length < 2) {
      setJoinError("Enter at least 2 characters");
      return;
    }
    try {
      setJoining(true);
      setJoinError(null);
      const member = await onJoinName(name);
      handleSelect(member);
      setCustomName("");
      setQuery("");
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Could not save your name");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="w-full">
      {currentMember ? (
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-bold flex items-center justify-center text-sm shrink-0">
              {currentMember.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-[var(--color-primary-text)] block">
                Checking off as
              </span>
              <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                {currentMember.name}
              </p>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-[var(--color-primary-text)] hover:text-[var(--color-primary)] flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-[var(--shadow-card)] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Who are you?
              </h3>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Pick your name, or type it if it is not listed.
              </p>
            </div>
          </div>

          {members.length > 6 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names…"
              className="w-full rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          )}

          {filtered.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filtered.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelect(member)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-text-secondary)] transition-all active:scale-95"
                >
                  {member.name}
                </button>
              ))}
            </div>
          ) : members.length > 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">
              No match in the group list — type your name below.
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-tertiary)]">
              No names on this list yet. Type yours to start ticking.
            </p>
          )}

          {onJoinName && !disabled && (
            <form onSubmit={handleJoin} className="pt-1 space-y-2">
              <label className="text-[11px] font-semibold text-[var(--color-text-secondary)] block">
                Not listed? Add your name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Riya Sharma"
                  maxLength={80}
                  className="flex-1 min-w-0 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={joining || customName.trim().length < 2}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {joining ? "…" : "Use"}
                </Button>
              </div>
              {joinError && (
                <p className={cn("text-[11px] text-[var(--color-status-overdue-fg)]")}>
                  {joinError}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
