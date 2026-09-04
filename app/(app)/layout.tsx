import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const unread = await prisma.notification
    .count({ where: { userId: session.id, readAt: null } })
    .catch(() => 0);

  return (
    <AppShell
      session={{ fullName: session.fullName, role: session.role, username: session.username }}
      notificationCount={unread}
    >
      {children}
    </AppShell>
  );
}
