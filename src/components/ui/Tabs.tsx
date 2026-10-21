import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 glass-chrome rounded-[var(--radius-md)] overflow-x-auto no-scrollbar border border-[var(--color-border-primary)] w-full",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all duration-150 select-none flex-1 min-w-0",
              isActive
                ? "bg-[var(--color-surface-solid)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "px-1.5 py-px rounded text-[10px] font-bold",
                  isActive
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)]"
                    : "bg-[var(--color-border-primary)] text-[var(--color-text-tertiary)]"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
