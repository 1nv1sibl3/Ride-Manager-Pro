import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyLogin } from "@/lib/session";

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

// ── CSRF: only accept same-origin POSTs ─────────────────────────────
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients don't send Origin
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

// ── Brute-force throttle ────────────────────────────────────────────
// In-memory sliding window: max 10 failed attempts per username+IP per
// 15 minutes. Single-instance only (self-hosted deployments); resets on
// restart, which is an acceptable trade-off for a shop tool.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const attempts = new Map<string, number[]>();

function checkLimit(key: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_FAILURES) {
    return { blocked: true, retryAfterSec: Math.ceil((list[0] + WINDOW_MS - now) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function recordFailure(key: string) {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  attempts.set(key, list);
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) {
      if (v.every((t) => now - t >= WINDOW_MS)) attempts.delete(k);
    }
  }
}

function clientKey(req: Request, username: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${username.toLowerCase()}@${ip}`;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const key = clientKey(req, parsed.data.username);
  const { blocked, retryAfterSec } = checkLimit(key);
  if (blocked) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const user = await verifyLogin(parsed.data.username, parsed.data.password);
  if (!user) {
    recordFailure(key);
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  attempts.delete(key);
  await createSession(user);
  return NextResponse.json({ ok: true });
}
