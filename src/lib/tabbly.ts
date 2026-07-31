/**
 * Tabbly configuration resolver.
 *
 * Priority:
 *   1. User's own keys (Settings → Tabbly Integration) — for advanced users
 *   2. Global keys from environment variables — so normal customers
 *      never need to configure anything. Owner sets these once in Vercel:
 *        TABBLY_API_KEY
 *        TABBLY_AGENT_ID
 *        TABBLY_ORGANIZATION_ID
 *        TABBLY_BASE_URL (optional)
 */

export interface TabblyConfig {
  apiKey: string;
  agentId: string;
  organizationId: string;
  baseUrl: string;
  source: "user" | "global" | "none";
}

const DEFAULT_BASE = "https://www.tabbly.io/dashboard/agents/endpoints";

export function resolveTabblyConfig(user: {
  tabblyApiKey?: string | null;
  tabblyAgentId?: string | null;
  tabblyOrganizationId?: string | null;
  tabblyBaseUrl?: string | null;
}): TabblyConfig {
  const cleanBase = (url: string) =>
    url.replace(/\/$/, "").replace("https://api.tabbly.ai/v1", DEFAULT_BASE);

  // 1. User's own keys take priority
  if (user.tabblyApiKey && user.tabblyAgentId) {
    return {
      apiKey: user.tabblyApiKey,
      agentId: user.tabblyAgentId,
      organizationId:
        user.tabblyOrganizationId || process.env.TABBLY_ORGANIZATION_ID || "",
      baseUrl: cleanBase(user.tabblyBaseUrl || DEFAULT_BASE),
      source: "user",
    };
  }

  // 2. Global environment keys (owner-configured, shared by all users)
  const envKey = process.env.TABBLY_API_KEY || "";
  const envAgent = process.env.TABBLY_AGENT_ID || "";
  if (envKey && envAgent) {
    return {
      apiKey: envKey,
      agentId: envAgent,
      organizationId: process.env.TABBLY_ORGANIZATION_ID || "",
      baseUrl: cleanBase(process.env.TABBLY_BASE_URL || DEFAULT_BASE),
      source: "global",
    };
  }

  // 3. Nothing configured
  return {
    apiKey: user.tabblyApiKey || envKey,
    agentId: user.tabblyAgentId || envAgent,
    organizationId: user.tabblyOrganizationId || process.env.TABBLY_ORGANIZATION_ID || "",
    baseUrl: cleanBase(user.tabblyBaseUrl || process.env.TABBLY_BASE_URL || DEFAULT_BASE),
    source: "none",
  };
}
