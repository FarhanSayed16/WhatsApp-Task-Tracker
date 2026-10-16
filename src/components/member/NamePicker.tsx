"use client";

import React, { useEffect, useState } from "react";
import { Member } from "@/types";
import { User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NamePickerProps {
  members: Member[];
  selectedMemberId: string | null;
  onSelectMember: (member: Member | null) => void;
  disabled?: boolean;
}

export function NamePicker({
  members,
  selectedMemberId,
  onSelectMember,
  disabled = false,
}: NamePickerProps) {
  const [hasInitialized, setHasInitialized] = useState(false);

  // Restore member choice from localStorage on initial load
  useEffect(() => {
    if (hasInitialized) return;

    try {
      const storedMemberId = localStorage.getItem("wtt_member_id");
      if (storedMemberId) {
        const found = members.find((m) => m.id === storedMemberId && m.active);
        if (found) {
          onSelectMember(found);
        }
      }
    } catch {
      // localStorage may not be available or blocked
    } finally {
      setHasInitialized(true);
    }
  }, [members, onSelectMember, hasInitialized]);

  const currentMember = members.find((m) => m.id === selectedMemberId);

  const handleSelect = (member: Member) => {
    try {
      localStorage.setItem("wtt_member_id", member.id);
      localStorage.setItem("wtt_member_name", member.name);
    } catch {
      // Ignore
    }
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

  return (
    <div className="w-full">
      {currentMember ? (
        // Selected state: compact greeting pill with change button
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
        // Unselected state: Friendly prompt with chips
        <div className="p-4 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Who are you?
              </h3>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Pick your name once to tick off tasks.
              </p>
            </div>
          </div>

          {/* Member chips — horizontal scroll on mobile */}
          <div className="flex flex-wrap gap-2 pt-1">
            {members.map((member) => (
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
        </div>
      )}
    </div>
  );
}
