"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "purple",
}: KpiCardProps) {
  const colorMap: Record<string, string> = {
    purple: "from-purple-600 to-blue-500",
    green: "from-emerald-500 to-teal-500",
    blue: "from-blue-500 to-cyan-500",
    yellow: "from-amber-500 to-orange-500",
    red: "from-red-500 to-rose-500",
    pink: "from-pink-500 to-rose-500",
  };

  const gradient = colorMap[color] || colorMap.purple;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-emerald-600" : "text-red-500"
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
            gradient
          )}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
