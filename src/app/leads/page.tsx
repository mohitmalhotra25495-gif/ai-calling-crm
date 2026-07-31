"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AuthProvider } from "@/lib/context";
import { ThemeProvider } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import { ToastProvider, useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/api";
import { formatDate, getRelativeTime } from "@/lib/utils";
import {
  Plus,
  Search,
  Filter,
  Download,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  PhoneOutgoing,
  Loader2,
  History,
} from "lucide-react";

interface LastCall {
  id: string;
  callStatus: string;
  sentiment: string;
  summary: string | null;
  callTime: string;
  callDuration: number;
}

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
  lastCall?: LastCall | null;
}

const ACTIVE_STATUSES = ["Pending", "Calling", "Ringing", "Connected"];

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Interested",
  "Follow Up",
  "Appointment Booked",
  "Not Interested",
  "Won",
  "Lost",
];

const SOURCE_OPTIONS = [
  "Manual",
  "AI Call",
  "Website",
  "Referral",
  "Social Media",
  "Email",
  "WhatsApp",
  "Other",
];

export default function LeadsPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppLayout>
            <LeadsContent />
          </AppLayout>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function LeadsContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [callingLeads, setCallingLeads] = useState<Set<string>>(new Set());
  const { toast, dismiss } = useToast();
  const prevStatusRef = useRef<Record<string, string>>({});

  const fetchLeads = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (sourceFilter) params.set("source", sourceFilter);

        const res = await apiFetch(`/api/leads?${params}`);
        if (res.ok) {
          const data = await res.json();
          // Detect status changes for toast notifications
          for (const lead of data.leads as Lead[]) {
            const prev = prevStatusRef.current[lead.id];
            const curr = lead.lastCall?.callStatus || "";
            if (prev && curr && prev !== curr) {
              if (curr === "Connected") toast("Call Connected! 🎉", "success");
              else if (curr === "Completed")
                toast(`Call Completed with ${lead.name}. CRM updated!`, "success");
              else if (curr === "Failed") toast(`Call Failed for ${lead.name}`, "error");
              else if (curr === "Busy") toast(`${lead.name}'s line is busy`, "info");
              else if (curr === "No Answer") toast(`${lead.name} didn't answer`, "info");
            }
            if (curr) prevStatusRef.current[lead.id] = curr;
          }
          setLeads(data.leads);
          setTotalPages(data.pagination.totalPages);
          setTotal(data.pagination.total);
        }
      } catch (e) {
        console.error("Failed to fetch leads", e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, search, statusFilter, sourceFilter, toast]
  );

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Live polling: sync from Tabbly + refresh when any call is active
  useEffect(() => {
    const hasActive = leads.some(
      (l) => l.lastCall && ACTIVE_STATUSES.includes(l.lastCall.callStatus)
    );
    if (!hasActive) return;
    const interval = setInterval(async () => {
      try {
        await apiFetch("/api/calls/sync", { method: "POST" });
      } catch {}
      fetchLeads(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [leads, fetchLeads]);

  // Independent status poller: polls GET /api/calls/[callId] every 5s.
  // Stops on terminal status or after 5 minutes max.
  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const TERMINAL_STATUSES = [
    "Completed",
    "Failed",
    "Busy",
    "No Answer",
    "Cancelled",
    "Missed",
  ];

  const startStatusPoller = useCallback(
    (callId: string, leadId: string, leadName: string) => {
      // Clear any existing poller for this lead
      if (pollersRef.current[leadId]) {
        clearInterval(pollersRef.current[leadId]);
      }
      const startedAt = Date.now();
      const MAX_POLL_MS = 20 * 60 * 1000; // 20 minutes (long calls log after they end)

      pollersRef.current[leadId] = setInterval(async () => {
        // Stop after 5 minutes max
        if (Date.now() - startedAt > MAX_POLL_MS) {
          clearInterval(pollersRef.current[leadId]);
          delete pollersRef.current[leadId];
          return;
        }
        try {
          const res = await apiFetch(`/api/calls/${callId}`);
          if (!res.ok) return;
          const data = await res.json();
          const status: string = data.call?.callStatus || "";
          if (!status) return;

          // Update the row badge live
          setLeads((prev) =>
            prev.map((l) =>
              l.id === leadId && l.lastCall
                ? { ...l, lastCall: { ...l.lastCall, callStatus: status } }
                : l
            )
          );

          if (TERMINAL_STATUSES.includes(status)) {
            clearInterval(pollersRef.current[leadId]);
            delete pollersRef.current[leadId];
            if (status === "Completed") {
              toast("🎉 Call completed, CRM updated", "success");
            } else {
              toast(`Call ${status} for ${leadName}`, "info");
            }
            fetchLeads(true);
          }
        } catch {
          // network blip - keep polling until max time
        }
      }, 5000);
    },
    [toast, fetchLeads]
  );

  // Cleanup all pollers on unmount
  useEffect(() => {
    const pollers = pollersRef.current;
    return () => {
      Object.values(pollers).forEach((p) => clearInterval(p));
    };
  }, []);

  async function startCall(lead: Lead) {
    if (callingLeads.has(lead.id)) return;
    setCallingLeads((prev) => new Set(prev).add(lead.id));
    const loadingId = toast(`Calling ${lead.name}...`, "loading");
    try {
      // Spinner covers ONLY the start-request (max 15s client timeout)
      const res = await apiFetch("/api/calls/start", {
        method: "POST",
        body: JSON.stringify({ leadId: lead.id }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      dismiss(loadingId);

      if (res.ok && data.ok) {
        // Success: stop spinner NOW, show badge, hand off to poller
        toast(`📞 Calling ${lead.name}...`, "success");
        prevStatusRef.current[lead.id] = "Calling";
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lead.id
              ? {
                  ...l,
                  lastCall: {
                    id: data.call?.id || "",
                    callStatus: "Calling",
                    sentiment: "Pending",
                    summary: "",
                    callTime: new Date().toISOString(),
                    callDuration: 0,
                  },
                }
              : l
          )
        );
        if (data.call?.id) {
          startStatusPoller(data.call.id, lead.id, lead.name);
        }
      } else if (data.code === "NOT_CONFIGURED") {
        toast("Tabbly not configured! Go to Settings → Tabbly Integration", "error");
      } else {
        toast(data.error || `Call failed (HTTP ${res.status})`, "error");
        fetchLeads(true);
      }
    } catch (e: any) {
      dismiss(loadingId);
      if (e?.name === "AbortError" || e?.name === "TimeoutError") {
        toast("Request timed out - check server logs", "error");
      } else {
        toast(String(e?.message || e), "error");
      }
    } finally {
      // ALWAYS stop the spinner - never skip
      setCallingLeads((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (res.ok) fetchLeads();
    } catch (e) {
      console.error("Failed to delete lead", e);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch("/api/leads/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Failed to export leads", e);
    }
  }

  const statusColors: Record<string, string> = {
    New: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    Contacted:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
    Interested:
      "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    "Follow Up":
      "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    "Appointment Booked":
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    "Not Interested":
      "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    Won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Lost: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Leads
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {total} leads in your pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-medium hover:from-purple-700 hover:to-blue-600 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Phone
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Company
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                  Source
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden xl:table-cell">
                  Last Call
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>No leads found</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <a
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          {lead.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {lead.name}
                          </p>
                          {lead.email && (
                            <p className="text-xs text-slate-500">
                              {lead.email}
                            </p>
                          )}
                        </div>
                      </a>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {lead.phoneNumber}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      {lead.company || "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                      {lead.source || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          statusColors[lead.status] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      {lead.lastCall ? (
                        <div className="max-w-[220px]">
                          <div className="flex items-center gap-1.5">
                            {ACTIVE_STATUSES.includes(lead.lastCall.callStatus) && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {lead.lastCall.callStatus}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              · {getRelativeTime(lead.lastCall.callTime)}
                            </span>
                          </div>
                          {lead.lastCall.summary && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {lead.lastCall.summary}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No calls yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {(() => {
                        // Spinner ONLY during the start request (max 15s).
                        const isStarting = callingLeads.has(lead.id);
                        // Active call: button disabled (no duplicate calls) but NO spinner.
                        const isActive =
                          lead.lastCall != null &&
                          ACTIVE_STATUSES.includes(lead.lastCall.callStatus);
                        return (
                          <button
                            onClick={() => startCall(lead)}
                            disabled={isStarting || isActive}
                            title={lead.lastCall ? "Call Again" : "Start AI Call"}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-medium hover:from-purple-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isStarting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="hidden sm:inline">Starting</span>
                              </>
                            ) : isActive ? (
                              <>
                                <PhoneOutgoing className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">In Call</span>
                              </>
                            ) : (
                              <>
                                <PhoneOutgoing className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                  {lead.lastCall ? "Call Again" : "Start AI Call"}
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })()}
                      <a
                        href={`/leads/${lead.id}`}
                        title="View History"
                        className="inline-flex p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-purple-600 transition-colors ml-1"
                      >
                        <History className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => {
                          setEditingLead(lead);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors ml-1"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 transition-colors ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modals */}
      {(showAddModal || showEditModal) && (
        <LeadModal
          lead={editingLead}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingLead(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingLead(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}

function LeadModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(lead?.name || "");
  const [phoneNumber, setPhoneNumber] = useState(lead?.phoneNumber || "");
  const [company, setCompany] = useState(lead?.company || "");
  const [email, setEmail] = useState(lead?.email || "");
  const [source, setSource] = useState(lead?.source || "Manual");
  const [status, setStatus] = useState(lead?.status || "New");
  const [notes, setNotes] = useState(lead?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = lead ? `/api/leads/${lead.id}` : "/api/leads";
      const method = lead ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phoneNumber,
          company,
          email,
          source,
          status,
          notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save lead");
      }
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {lead ? "Edit Lead" : "Add Lead"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-medium hover:from-purple-700 hover:to-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : lead ? "Update Lead" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
