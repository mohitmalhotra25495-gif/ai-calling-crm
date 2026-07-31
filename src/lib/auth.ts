import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "ai-calling-crm-secret-key-2024";
const JWT_EXPIRES_IN = "7d";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  businessLogo: string | null;
  timezone: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      companyName: decoded.companyName || null,
      businessLogo: decoded.businessLogo || null,
      timezone: decoded.timezone || null,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from the request - tries Authorization header first, then cookie
 */
export function getTokenFromRequest(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Get the authenticated user from a request (for API routes)
 */
export async function getAuthUserFromRequest(
  request: Request
): Promise<AuthUser | null> {
  try {
    // Try Authorization header first
    const token = getTokenFromRequest(request);
    if (token) {
      return verifyToken(token);
    }
    // Fall back to cookie
    return await getAuthUser();
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user from cookies (for server components)
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function getFullUser(userId: string) {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return results[0] || null;
}
