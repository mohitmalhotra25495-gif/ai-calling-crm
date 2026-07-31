"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthProvider } from "@/lib/context";
import { ThemeProvider } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import { formatDateTime, formatDuration, getRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { Search, Phone, ChevronLeft, ChevronRight, FileText, Mic } from "lucide-react";

interface Call {
  id: string;
  customerName: string;
  phoneNumber: string;
  callDuration: number;
  callStatus: string;
  leadStatus: string;
  sentiment: string;
  callTime: string;
  summary: string | null;
  agentName: string | null;
}

export default function CallsPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout>
          <CallsContent />
        </AppLayout>
      </ThemeProvider>
    </AuthProvider>
  );
}

function CallsContent() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/calls?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (e) {
      console.error("Failed to fetch calls", e);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const statusColors: Record<string, string> = {
    Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Answered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Missed: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    "No Answer": "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
    Busy: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    Failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  };

  const sentimentColors: Record<string, string> = {
    Positive: "text-emerald-600 dark:text-emerald-400",
    Neutral: "text-slate-600 dark:text-slate-400",
    Negative: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          AI Call History
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {total} total calls
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by customer name or phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  Date & Time
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Duration
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                  AI Agent
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Lead Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Sentiment
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <Phone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>No calls found</p>
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/calls/${call.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          {call.customerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {call.customerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {call.phoneNumber}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                      {formatDateTime(call.callTime)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      {formatDuration(call.callDuration)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 hidden xl:table-cell">
                      {call.agentName || "AI Agent"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          statusColors[call.callStatus] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {call.callStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                      {call.leadStatus}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span
                        className={`text-sm font-medium ${
                          sentimentColors[call.sentiment] || ""
                        }`}
                      >
                        {call.sentiment}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/calls/${call.id}`}
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" /> View
                      </Link>
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
    </div>
  );
}
