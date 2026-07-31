"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthProvider, ThemeProvider } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatDuration, getRelativeTime } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  Mail,
  Building,
  Tag,
  Bot,
  FileText,
  Loader2,
  PhoneOutgoing,
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  phoneNumber: string;
  company: string | null;
  email: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface Call {
  id: string;
  agentName: string | null;
  callDuration: number;
  callStatus: string;
  leadStatus: string;
  sentiment: string;
  callTime: string;
  summary: string | null;
}

export default function LeadDetailPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout>
          <LeadDetailContent />
        </AppLayout>
      </ThemeProvider>
    </AuthProvider>
  );
}

function LeadDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [callMsg, setCallMsg] = useState("");

  const ACTIVE_STATUSES = ["Pending", "Calling", "Ringing", "Connected"];

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/leads/${params.id}/calls`);
      if (res.ok) {
        const data = await res.json();
        setLead(data.lead);
        setCalls(data.calls || []);
      }
    } catch (e) {
      console.error("Failed to fetch lead calls", e);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) fetchData();
  }, [params.id, fetchData]);

  // Live polling when a call is active: sync from Tabbly + refresh
  useEffect(() => {
    const hasActive = calls.some((c) => ACTIVE_STATUSES.includes(c.callStatus));
    if (!hasActive) return;
    const interval = setInterval(async () => {
      try {
        await apiFetch("/api/calls/sync", { method: "POST" });
      } catch {}
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, fetchData]);

  async function syncNow() {
    setCallMsg("🔄 Syncing status from Tabbly...");
    try {
      const res = await apiFetch("/api/calls/sync", { method: "POST" });
      const data = await res.json();
      setCallMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
      await fetchData();
    } catch {
      setCallMsg("❌ Sync failed - network error");
    }
    setTimeout(() => setCallMsg(""), 8000);
  }

  async function startRealCall() {
    setStarting(true);
    setCallMsg("");
    try {
      // Spinner covers ONLY the start request (max 15s client timeout)
      const res = await apiFetch("/api/calls/start", {
        method: "POST",
        body: JSON.stringify({ leadId: params.id }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setCallMsg("📞 Calling... Status will update below automatically.");
        await fetchData();
      } else if (data.code === "NOT_CONFIGURED") {
        setCallMsg("⚠️ Tabbly not configured. Go to Settings → Tabbly Integration.");
      } else {
        setCallMsg(`❌ ${data.error || `Call failed (HTTP ${res.status})`}`);
        await fetchData();
      }
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.name === "TimeoutError") {
        setCallMsg("❌ Request timed out - check server logs");
      } else {
        setCallMsg(`❌ ${String(e?.message || e)}`);
      }
    } finally {
      // ALWAYS stop the spinner
      setStarting(false);
      setTimeout(() => setCallMsg(""), 8000);
    }
  }

  async function simulateCall() {
    setSimulating(true);
    try {
      const res = await apiFetch("/api/calls/simulate", {
        method: "POST",
        body: JSON.stringify({ leadId: params.id }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error("Simulate call failed", e);
    } finally {
      setSimulating(false);
    }
  }

  const statusColors: Record<string, string> = {
    Answered:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Completed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Missed: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    Failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
    Busy: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    "No Answer": "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
    Cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    Pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 animate-pulse",
    Calling: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 animate-pulse",
    Ringing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 animate-pulse",
    Connected: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 animate-pulse",
  };

  const sentimentColors: Record<string, string> = {
    Interested:
      "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    "Not Interested":
      "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    Callback:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
    "Appointment Booked":
      "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Lead not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/leads")}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </button>

      {/* Lead Info Card */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
              {lead.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {lead.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {lead.phoneNumber}
                </span>
                {lead.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {lead.email}
                  </span>
                )}
                {lead.company && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" /> {lead.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> {lead.source}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
              {lead.status}
            </span>
            <button
              onClick={startRealCall}
              disabled={starting || calls.some((c) => ACTIVE_STATUSES.includes(c.callStatus))}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-medium hover:from-purple-700 hover:to-blue-600 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2 disabled:opacity-60"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <PhoneOutgoing className="w-4 h-4" />
                  {calls.length > 0 ? "Call Again" : "Start AI Call"}
                </>
              )}
            </button>
            {calls.some((c) => ACTIVE_STATUSES.includes(c.callStatus)) && (
              <button
                onClick={syncNow}
                className="px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
              >
                🔄 Sync Status
              </button>
            )}
            <button
              onClick={simulateCall}
              disabled={simulating}
              className="px-4 py-2 rounded-lg border border-purple-300 dark:border-purple-500/40 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {simulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Calling...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" /> Simulate Call
                </>
              )}
            </button>
          </div>
        </div>
        {callMsg && (
          <p className="mt-4 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-lg p-3 animate-fade-in">
            {callMsg}
          </p>
        )}
        {lead.notes && (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
            📝 {lead.notes}
          </p>
        )}
      </div>

      {/* Call History */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-purple-500" />
            Call History ({calls.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  AI Agent
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  Sentiment
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Phone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>No calls yet for this lead</p>
                    <p className="text-xs mt-1">
                      Click &quot;Simulate AI Call&quot; to test the AI calling flow
                    </p>
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {formatDateTime(call.callTime)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {getRelativeTime(call.callTime)}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {formatDuration(call.callDuration)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          statusColors[call.callStatus] ||
                          "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {call.callStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                        <Bot className="w-3.5 h-3.5 text-purple-500" />
                        {call.agentName || "AI Agent"}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          sentimentColors[call.sentiment] ||
                          "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {call.sentiment}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/calls/${call.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
