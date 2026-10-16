import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Users, Clock, ChevronRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export interface GroupCardProps {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  activeTaskListCount?: number;
  completionRate?: number; // 0 to 100
  lastActivityAt?: string | null;
  verifyRequired?: boolean;
}

export function GroupCard({
  id,
  name,
  description,
  memberCount,
  activeTaskListCount = 0,
  completionRate = 0,
  lastActivityAt,
  verifyRequired = false,
}: GroupCardProps) {
  return (
    <Link href={`/admin/groups/${id}`} className="block group">
      <Card
        variant="interactive"
        className="p-5 flex flex-col justify-between h-full"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
              {name}
            </h3>
            {verifyRequired && (
              <Badge variant="verified" className="text-[10px] py-0 px-1.5 shrink-0">
                ✓✓
              </Badge>
            )}
          </div>

          {description && (
            <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 mb-3">
              {description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)] mb-4">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
              <span>{memberCount} members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{activeTaskListCount} active lists</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--color-border-secondary)]">
          <ProgressBar
            value={completionRate}
            showLabel={true}
            size="sm"
          />

          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)] pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastActivityAt
                ? formatRelativeTime(lastActivityAt)
                : "No recent activity"}
            </span>
            <span className="text-[var(--color-primary-text)] font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
              View <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
