"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/context";
import { ThemeProvider } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import { KpiCard } from "@/components/KpiCard";
import { formatDate, formatDuration, getRelativeTime } from "@/lib/utils";
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  Users,
  CalendarCheck,
  TrendingUp,
  Clock,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface Kpis {
  totalCalls: number;
  callsToday: number;
  connectedCalls: number;
  missedCalls: number;
  totalLeads: number;
  interestedLeads: number;
  appointmentsBooked: number;
  conversionRate: number;
  avgCallDuration: number;
}

interface RecentCall {
  id: string;
  customerName: string;
  phoneNumber: string;
  callStatus: string;
  sentiment: string;
  callTime: string;
  callDuration: number;
  leadStatus: string;
}

interface RecentLead {
  id: string;
  name: string;
  phoneNumber: string;
  company: string;
  status: string;
  source: string;
  createdAt: string;
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout>
          <DashboardContent />
        </AppLayout>
      </ThemeProvider>
    </AuthProvider>
  );
}

function DashboardContent() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis);
        setRecentCalls(data.recentCalls || []);
        setRecentLeads(data.recentLeads || []);
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Overview of your AI calling performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <KpiCard
          title="Total Calls"
          value={kpis?.totalCalls || 0}
          icon={Phone}
          color="purple"
        />
        <KpiCard
          title="Calls Today"
          value={kpis?.callsToday || 0}
          icon={PhoneCall}
          color="blue"
        />
        <KpiCard
          title="Connected Calls"
          value={kpis?.connectedCalls || 0}
          icon={PhoneCall}
          color="green"
        />
        <KpiCard
          title="Missed Calls"
          value={kpis?.missedCalls || 0}
          icon={PhoneMissed}
          color="red"
        />
        <KpiCard
          title="Interested Leads"
          value={kpis?.interestedLeads || 0}
          icon={Users}
          color="purple"
        />
        <KpiCard
          title="Appointments"
          value={kpis?.appointmentsBooked || 0}
          icon={CalendarCheck}
          color="green"
        />
        <KpiCard
          title="Conversion Rate"
          value={`${kpis?.conversionRate || 0}%`}
          icon={TrendingUp}
          color="yellow"
        />
        <KpiCard
          title="Avg Duration"
          value={formatDuration(kpis?.avgCallDuration || 0)}
          icon={Clock}
          color="pink"
        />
      </div>

      {/* Recent Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-purple-500" />
              Recent Calls
            </h2>
            <Link
              href="/calls"
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {recentCalls.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-sm">
                No calls yet
              </p>
            ) : (
              recentCalls.slice(0, 5).map((call) => (
                <Link
                  key={call.id}
                  href={`/calls/${call.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {call.customerName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {call.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {call.phoneNumber} · {getRelativeTime(call.callTime)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-slate-500">
                      {formatDuration(call.callDuration)}
                    </span>
                    <p className="text-xs text-slate-400">
                      {call.callStatus}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Recent Leads
            </h2>
            <Link
              href="/leads"
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {recentLeads.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-sm">
                No leads yet
              </p>
            ) : (
              recentLeads.slice(0, 5).map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                      {lead.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {lead.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lead.company || "No company"} ·{" "}
                        {getRelativeTime(lead.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      lead.status === "New"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        : lead.status === "Interested"
                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : lead.status === "Contacted"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                        : lead.status === "Won"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : lead.status === "Lost"
                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400"
                    }`}
                  >
                    {lead.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
