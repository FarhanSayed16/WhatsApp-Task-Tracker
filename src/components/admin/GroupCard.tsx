import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Users, Clock, ShieldCheck, ChevronRight } from "lucide-react";
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
        className="p-5 flex flex-col justify-between h-full group-hover:border-emerald-500/50"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
              {name}
            </h3>
            {verifyRequired ? (
              <Badge variant="verified" className="text-[10px] py-0 px-2 shrink-0">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-[10px] py-0 px-2 shrink-0">
                Direct
              </Badge>
            )}
          </div>

          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
              {description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-4">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{memberCount} members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{activeTaskListCount} active lists</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <ProgressBar
            value={completionRate}
            showLabel={true}
            size="sm"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastActivityAt
                ? formatRelativeTime(lastActivityAt)
                : "No recent activity"}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
              View <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
