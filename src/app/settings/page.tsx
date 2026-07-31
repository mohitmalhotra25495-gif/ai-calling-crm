"use client";

import { useState, useEffect } from "react";
import { AuthProvider, ThemeProvider, useAuth } from "@/lib/context";
import { AppLayout } from "@/components/AppLayout";
import { apiFetch } from "@/lib/api";
import { Settings as SettingsIcon, Building, Globe, Bell, Save, PhoneCall, Copy, Check } from "lucide-react";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function SettingsPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppLayout>
          <SettingsContent />
        </AppLayout>
      </ThemeProvider>
    </AuthProvider>
  );
}

function SettingsContent() {
  const { refreshUser } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [businessLogo, setBusinessLogo] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [notifyCallComplete, setNotifyCallComplete] = useState(true);
  const [notifyAppointment, setNotifyAppointment] = useState(true);
  const [notifyFollowUp, setNotifyFollowUp] = useState(true);
  const [notifyNewLead, setNotifyNewLead] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  // Tabbly integration
  const [tabblyApiKey, setTabblyApiKey] = useState("");
  const [tabblyApiKeyHint, setTabblyApiKeyHint] = useState("");
  const [tabblyAgentId, setTabblyAgentId] = useState("");
  const [tabblyOrganizationId, setTabblyOrganizationId] = useState("");
  const [tabblyBaseUrl, setTabblyBaseUrl] = useState("https://www.tabbly.io/dashboard/agents/endpoints");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    agents?: { id: number; name: string }[];
  } | null>(null);
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/tabbly`
      : "/api/webhooks/tabbly";

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await apiFetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;
        setCompanyName(s.companyName || "");
        setBusinessLogo(s.businessLogo || "");
        setTimezone(s.timezone || "UTC");
        if (s.notificationPreferences) {
          setNotifyCallComplete(s.notificationPreferences.emailCallComplete ?? true);
          setNotifyAppointment(
            s.notificationPreferences.emailAppointmentBooked ?? true
          );
          setNotifyFollowUp(s.notificationPreferences.emailFollowUpDue ?? true);
          setNotifyNewLead(s.notificationPreferences.emailNewLead ?? true);
        }
        setTabblyApiKeyHint(s.tabblyApiKeyHint || "");
        setTabblyAgentId(s.tabblyAgentId || "");
        setTabblyOrganizationId(s.tabblyOrganizationId || "");
        setTabblyBaseUrl(s.tabblyBaseUrl || "https://www.tabbly.io/dashboard/agents/endpoints");
        setWebhookSecret(s.webhookSecret || "");
      }
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          businessLogo,
          timezone,
          notificationPreferences: {
            emailCallComplete: notifyCallComplete,
            emailAppointmentBooked: notifyAppointment,
            emailFollowUpDue: notifyFollowUp,
            emailNewLead: notifyNewLead,
          },
          tabblyApiKey: tabblyApiKey || undefined,
          tabblyAgentId,
          tabblyOrganizationId,
          tabblyBaseUrl,
          webhookSecret,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      setSuccess(true);
      refreshUser();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("/api/settings/test-tabbly", { method: "POST" });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || "Unknown result",
        agents: data.agents,
      });
    } catch {
      setTestResult({ success: false, message: "Network error while testing" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Configure your account preferences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-purple-500" />
            Company Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Your company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Business Logo URL
              </label>
              <input
                type="url"
                value={businessLogo}
                onChange={(e) => setBusinessLogo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-500" />
            Time Zone
          </h2>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Tabbly Integration */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-purple-500" />
            Tabbly Integration (Outbound AI Calls)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Configure your Tabbly credentials to enable real outbound AI calls.
            The API key is stored securely on the server and never exposed.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tabbly API Key {tabblyApiKeyHint && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">
                    ✓ Saved ({tabblyApiKeyHint})
                  </span>
                )}
              </label>
              <input
                type="password"
                value={tabblyApiKey}
                onChange={(e) => setTabblyApiKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder={tabblyApiKeyHint ? "Leave blank to keep existing key" : "tb_xxxxxxxxxxxx"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Agent ID{" "}
                <span className="text-xs text-slate-400">
                  (numeric — e.g. 123, from Tabbly dashboard)
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={tabblyAgentId}
                onChange={(e) => setTabblyAgentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Organization ID{" "}
                <span className="text-xs text-slate-400">
                  (from Tabbly dashboard — needed for call status sync)
                </span>
              </label>
              <input
                type="text"
                value={tabblyOrganizationId}
                onChange={(e) => setTabblyOrganizationId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="org_xyz789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tabbly API Base URL
              </label>
              <input
                type="url"
                value={tabblyBaseUrl}
                onChange={(e) => setTabblyBaseUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="https://www.tabbly.io/dashboard/agents/endpoints"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Webhook Secret (optional)
              </label>
              <input
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Shared secret for webhook verification"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Your Webhook URL (paste this in Tabbly dashboard)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Test Connection */}
            <div>
              <button
                type="button"
                onClick={testConnection}
                disabled={testing}
                className="px-4 py-2 rounded-lg border border-purple-300 dark:border-purple-500/40 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all disabled:opacity-50"
              >
                {testing ? "Testing..." : "🔌 Test Tabbly Connection"}
              </button>
              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-lg text-sm ${
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                      : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                  }`}
                >
                  <p className="font-medium">
                    {testResult.success ? "✅ " : "❌ "}
                    {testResult.message}
                  </p>
                  {testResult.agents && testResult.agents.length > 0 && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold mb-1">Your Agents (use the ID below):</p>
                      {testResult.agents.map((a) => (
                        <p key={a.id}>
                          • ID: <b>{a.id}</b> — {a.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-500" />
            Notification Preferences
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "AI completes a call",
                checked: notifyCallComplete,
                onChange: setNotifyCallComplete,
              },
              {
                label: "Appointment is booked",
                checked: notifyAppointment,
                onChange: setNotifyAppointment,
              },
              {
                label: "Follow-up is due",
                checked: notifyFollowUp,
                onChange: setNotifyFollowUp,
              },
              {
                label: "New lead is added",
                checked: notifyNewLead,
                onChange: setNotifyNewLead,
              },
            ].map((item) => (
              <label
                key={item.label}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {item.label}
                </span>
                <button
                  type="button"
                  onClick={() => item.onChange(!item.checked)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    item.checked
                      ? "bg-gradient-to-r from-purple-600 to-blue-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      item.checked ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
            Settings saved successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 text-white font-medium hover:from-purple-700 hover:to-blue-600 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
