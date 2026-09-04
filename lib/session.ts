import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";

const COOKIE = "rental_session";
const TTL_DAYS = 30;

export type Role = "owner" | "staff" | "manager";
export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
};

// Cookie holds raw token; DB stores SHA-256 hash (so a DB leak can't be replayed).
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(user: SessionUser) {
  const raw = randomBytes(32).toString("base64url");
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { id: hash(raw), userId: user.id, expiresAt, userAgent: ua },
  });
  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    await prisma.session.deleteMany({ where: { id: hash(raw) } }).catch(() => {});
  }
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const row = await prisma.session.findUnique({
    where: { id: hash(raw) },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date() || !row.user || !row.user.active) {
    if (row) await prisma.session.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  // Touch lastSeenAt occasionally (skip on every request to avoid write storm).
  if (Date.now() - row.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await prisma.session
      .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  return {
    id: row.user.id,
    username: row.user.username,
    fullName: row.user.fullName,
    role: row.user.role,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export async function requireOwner(): Promise<SessionUser> {
  const s = await requireSession();
  if (s.role !== "owner") throw new Error("FORBIDDEN");
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireSession();
  if (s.role !== "owner" && s.role !== "manager") throw new Error("FORBIDDEN");
  return s;
}

// Compare against a throwaway hash when the user doesn't exist so response
// timing doesn't reveal which usernames are registered.
let dummyHash: string | null = null;
async function timingEqualizer(password: string) {
  dummyHash ??= bcrypt.hashSync("no-such-user", 10);
  await bcrypt.compare(password, dummyHash).catch(() => null);
}

export async function verifyLogin(username: string, password: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({ where: { username } });
  if (!u || !u.active) {
    await timingEqualizer(password);
    return null;
  }
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return null;
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role };
}
