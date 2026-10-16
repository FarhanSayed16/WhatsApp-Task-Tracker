"use client";

import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Edit2, Trash2, Phone, UserCheck, UserX } from "lucide-react";

export interface MemberRowProps {
  id: string;
  name: string;
  phone?: string | null;
  active: boolean;
  completionsCount?: number;
  onEdit?: (id: string) => void;
  onToggleActive?: (id: string, currentActive: boolean) => void;
  onDelete?: (id: string) => void;
}

export function MemberRow({
  id,
  name,
  phone,
  active,
  completionsCount = 0,
  onEdit,
  onToggleActive,
  onDelete,
}: MemberRowProps) {
  // Mask phone number for privacy: e.g. 9876543210 -> 98*****210
  const maskPhone = (num?: string | null) => {
    if (!num) return "No phone";
    if (num.length <= 5) return num;
    const start = num.slice(0, 2);
    const end = num.slice(-3);
    return `${start}*****${end}`;
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors gap-4">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
            active
              ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)]"
              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-disabled)]"
          }`}
        >
          {name.slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {name}
            </span>
            <Badge
              variant={active ? "active" : "neutral"}
              className="text-[10px] py-0 px-1.5"
            >
              {active ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)] mt-0.5">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {maskPhone(phone)}
            </span>
            <span>·</span>
            <span>{completionsCount} completed</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onToggleActive && (
          <Button
            size="sm"
            variant="ghost"
            className="p-1.5"
            onClick={() => onToggleActive(id, active)}
            title={active ? "Deactivate member" : "Activate member"}
            aria-label={active ? "Deactivate member" : "Activate member"}
          >
            {active ? (
              <UserX className="w-4 h-4 text-[var(--color-status-pending-fg)]" />
            ) : (
              <UserCheck className="w-4 h-4 text-[var(--color-primary)]" />
            )}
          </Button>
        )}

        {onEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="p-1.5"
            onClick={() => onEdit(id)}
            title="Edit member"
            aria-label="Edit member"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        )}

        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="p-1.5 hover:text-[var(--color-danger)]"
            onClick={() => onDelete(id)}
            title="Delete member"
            aria-label="Delete member"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
