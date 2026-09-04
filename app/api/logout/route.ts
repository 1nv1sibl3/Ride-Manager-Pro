import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url));
}

export async function GET(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url));
}
