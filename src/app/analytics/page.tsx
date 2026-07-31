"use client";

import { useState, useEffect } from "react";
import { AuthProvider, ThemeProvider } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { BarChart3, TrendingUp, Phone, Clock } from "lucide-react";

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

export default function AnalyticsPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout>
          <AnalyticsContent />
        </AppLayout>
      </ThemeProvider>
    </AuthProvider>
  );
}

function AnalyticsContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (e) {
      console.error("Failed to fetch analytics", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const callsPerDayData = (data?.callsPerDay || []).map((item: any) => ({
    date: item.date ? new Date(item.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "",
    calls: Number(item.count),
  }));

  const leadStatusData = (data?.leadStatusDistribution || []).map((item: any) => ({
    name: item.status,
    value: Number(item.count),
  }));

  const callStatusData = (data?.callStatusDistribution || []).map((item: any) => ({
    name: item.status,
    value: Number(item.count),
  }));

  const connectedCount =
    callStatusData.find((d: any) => d.name === "Completed")?.value || 0;
  const missedCount =
    callStatusData.find((d: any) => d.name === "Missed")?.value || 0;

  const connectedVsMissed = [
    { name: "Connected", value: connectedCount },
    { name: "Missed", value: missedCount },
  ];

  const conversionData = [
    { name: "Converted", value: data?.kpis?.interestedLeads || 0 },
    { name: "Remaining", value: (data?.kpis?.totalLeads || 0) - (data?.kpis?.interestedLeads || 0) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Analytics
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Insights and performance metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls Per Day */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Calls Per Day
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callsPerDayData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:opacity-20"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Bar
                  dataKey="calls"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Connected vs Missed */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-purple-500" />
            Connected vs Missed
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={connectedVsMissed}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(props: any) => {
                    const name = props.name || "";
                    const percent = props.percent || 0;
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                >
                  {connectedVsMissed.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "#10b981" : "#ef4444"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Status Distribution */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            Lead Status Distribution
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={(props: any) => {
                    const name = props.name || "";
                    const percent = props.percent || 0;
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                >
                  {leadStatusData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            Conversion Overview
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(props: any) => {
                    const name = props.name || "";
                    const percent = props.percent || 0;
                    return `${name} ${(percent * 100).toFixed(0)}%`;
                  }}
                >
                  {conversionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "#8b5cf6" : "#e2e8f0"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {data?.kpis?.conversionRate || 0}%
            </p>
            <p className="text-sm text-slate-500">Overall Conversion Rate</p>
          </div>
        </div>

        {/* Average Call Duration */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-500" />
            Call Duration Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500 mb-1">
                Average Duration
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {Math.floor((data?.kpis?.avgCallDuration || 0) / 60)}m{" "}
                {(data?.kpis?.avgCallDuration || 0) % 60}s
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500 mb-1">Total Calls</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {data?.kpis?.totalCalls || 0}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500 mb-1">Today</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {data?.kpis?.callsToday || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
