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
    <div className="flex items-center justify-between py-3.5 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800 gap-4">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
            active
              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
              : "bg-slate-200 dark:bg-slate-800 text-slate-500"
          }`}
        >
          {name.slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {name}
            </span>
            <Badge
              variant={active ? "verified" : "neutral"}
              className="text-[10px] py-0 px-2"
            >
              {active ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
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
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={() => onToggleActive(id, active)}
            title={active ? "Deactivate member" : "Activate member"}
            aria-label={active ? "Deactivate member" : "Activate member"}
          >
            {active ? (
              <UserX className="w-4 h-4 text-amber-500" />
            ) : (
              <UserCheck className="w-4 h-4 text-emerald-500" />
            )}
          </Button>
        )}

        {onEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
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
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
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
