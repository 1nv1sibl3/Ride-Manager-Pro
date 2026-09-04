import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { UsersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner" && session.role !== "manager") redirect("/dashboard");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [users, bookingsAll, bookingsMonth, paymentsAll, paymentsMonth, lastActive] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      select: {
        id: true, username: true, fullName: true, email: true, phone: true,
        role: true, active: true, createdAt: true,
      },
    }),
    prisma.booking.groupBy({ by: ["createdById"], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["createdById"],
      _count: { _all: true },
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.payment.groupBy({
      by: ["recordedById"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["recordedById"],
      _count: { _all: true },
      _sum: { amount: true },
      where: { createdAt: { gte: monthStart }, kind: { not: "deposit" } },
    }),
    prisma.session.groupBy({ by: ["userId"], _max: { lastSeenAt: true } }),
  ]);

  const bookingsAllMap = new Map(bookingsAll.map((b) => [b.createdById, b._count._all]));
  const bookingsMonthMap = new Map(bookingsMonth.map((b) => [b.createdById, b._count._all]));
  const paymentsAllMap = new Map(paymentsAll.map((p) => [p.recordedById, { count: p._count._all, sum: p._sum.amount ?? 0 }]));
  const paymentsMonthMap = new Map(paymentsMonth.map((p) => [p.recordedById, { count: p._count._all, sum: p._sum.amount ?? 0 }]));
  const lastActiveMap = new Map(lastActive.map((s) => [s.userId, s._max.lastSeenAt?.toISOString() ?? null]));

  return (
    <UsersClient
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        bookingsAll: bookingsAllMap.get(u.id) ?? 0,
        bookingsMonth: bookingsMonthMap.get(u.id) ?? 0,
        paymentsAll: paymentsAllMap.get(u.id)?.count ?? 0,
        paymentsMonthSum: paymentsMonthMap.get(u.id)?.sum ?? 0,
        lastActive: lastActiveMap.get(u.id) ?? null,
      }))}
      currentUserId={session.id}
      currentRole={session.role}
    />
  );
}
