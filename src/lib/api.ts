/**
 * Client-side API fetch helper that automatically includes the auth token.
 * Use this instead of raw fetch() for all API calls from client components.
 */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // Try localStorage first
  const token = localStorage.getItem("token");
  if (token) return token;
  // Try cookie fallback
  const match = document.cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include", // include cookies as fallback
  });
}

/**
 * Store auth token both in localStorage and as a regular cookie (for server-side reading)
 */
export function storeToken(token: string): void {
  localStorage.setItem("token", token);
  // Set as non-httpOnly cookie for server-side access
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; sameSite=lax`;
}

/**
 * Remove auth token from both localStorage and cookies
 */
export function clearToken(): void {
  localStorage.removeItem("token");
  document.cookie = "token=; path=/; max-age=0";
}
