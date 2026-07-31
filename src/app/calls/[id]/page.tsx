"use client";

import { useState, useEffect } from "react";
import { AuthProvider, ThemeProvider } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Clock,
  User,
  BarChart3,
  MessageSquare,
  Mic,
  Download,
  Play,
  Pause,
  Calendar,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";

interface CallDetail {
  id: string;
  customerName: string;
  phoneNumber: string;
  callDuration: number;
  callStatus: string;
  leadStatus: string;
  sentiment: string;
  summary: string;
  interestScore: number;
  buyingIntent: string;
  nextBestAction: string;
  followUpSuggestion: string;
  callTime: string;
  agentId: string | null;
  agentName: string | null;
  leadId: string | null;
}

interface Recording {
  id: string;
  recordingUrl: string;
  duration: number;
  format: string;
}

interface TranscriptMessage {
  speaker: string;
  text: string;
  timestamp: string;
}

interface TranscriptData {
  id: string;
  messages: TranscriptMessage[];
  fullText: string;
}

export default function CallDetailPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout>
          <CallDetailContent />
        </AppLayout>
      </ThemeProvider>
    </AuthProvider>
  );
}

function CallDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (params.id) fetchCallDetail();
  }, [params.id]);

  async function fetchCallDetail() {
    try {
      const res = await fetch(`/api/calls/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setCall(data.call);
        setRecordings(data.recordings || []);
        setTranscript(data.transcript);
      }
    } catch (e) {
      console.error("Failed to fetch call detail", e);
    } finally {
      setLoading(false);
    }
  }

  function togglePlay(recordingUrl: string) {
    if (audioPlayer) {
      if (isPlaying) {
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        audioPlayer.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(recordingUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioPlayer(audio);
      setIsPlaying(true);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Call not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Calls
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
              {call.customerName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {call.customerName}
              </h1>
              <p className="text-sm text-slate-500">{call.phoneNumber}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                🤖 {call.agentName || "AI Agent"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {call.callStatus}
              </p>
              <p className="text-xs text-slate-500">
                {formatDuration(call.callDuration)}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
              {call.leadStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Analysis */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              AI Analysis
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Interest Score</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {call.interestScore}/10
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Sentiment</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {call.sentiment}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Buying Intent</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {call.buyingIntent}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 col-span-2">
                <p className="text-xs text-slate-500 mb-1">
                  Next Best Action
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {call.nextBestAction || "Not available"}
                </p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-purple-500" />
              Call Summary
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {call.summary || "No summary available."}
            </p>
          </div>

          {/* Transcript */}
          {transcript && transcript.messages && transcript.messages.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                Transcript
              </h2>
              <div className="space-y-3">
                {transcript.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${
                      msg.speaker === "AI" || msg.speaker === "Agent"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                        msg.speaker === "AI" || msg.speaker === "Agent"
                          ? "bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20"
                          : "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20"
                      }`}
                    >
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
                        {msg.speaker}:
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {msg.text}
                      </p>
                      {msg.timestamp && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {msg.timestamp}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up Suggestion */}
          {call.followUpSuggestion && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                Follow-up Suggestion
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {call.followUpSuggestion}
              </p>
              <div className="mt-4">
                <Link
                  href={`/leads?search=${call.customerName}`}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Schedule Follow-up →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Call Details */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">
              Call Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  {formatDateTime(call.callTime)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  Duration: {formatDuration(call.callDuration)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  Status: {call.callStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Recording */}
          {recordings.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-500" />
                Call Recording
              </h3>
              {recordings.map((rec) => (
                <div key={rec.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePlay(rec.recordingUrl)}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 flex items-center justify-center text-white hover:from-purple-700 hover:to-blue-600 transition-all shadow-lg"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all"
                          style={{ width: isPlaying ? "45%" : "0%" }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-400">
                          {formatDuration(rec.duration || call.callDuration)}
                        </span>
                        <a
                          href={rec.recordingUrl}
                          download
                          className="text-[10px] text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link
                href={call.leadId ? `/leads/${call.leadId}` : "/leads"}
                className="block w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-center"
              >
                View Lead
              </Link>
              <Link
                href={`/leads`}
                className="block w-full px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600 transition-all text-center"
              >
                Schedule Follow-up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
