import { timingSafeEqual } from "crypto";
import { runReminderScan } from "@/lib/reminder-scan";

// Authoritative trigger for the reminder scan + digest email. Point any
// external cron (GitHub Actions schedule, cron-job.org, uptime monitor) at:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders
//
// Without CRON_SECRET set this always returns 401. A lazy in-app fallback
// (dashboard, max once per ~20h) covers deployments with no cron at all.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  // Reading the request keeps this handler dynamic (never prerendered).
  void req.headers.get("authorization");
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReminderScan();
  return Response.json({ ok: true, ...result });
}
