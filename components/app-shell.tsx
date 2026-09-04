"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  CalendarCheck,
  Bike,
  BarChart3,
  ScrollText,
  Users,
  LogOut,
  Menu,
  X,
  AlarmClock,
  Package,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";

type Role = "owner" | "staff" | "manager";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  roles?: Role[];
};

const NAV: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activity", label: "Activity", icon: CalendarCheck },
  { href: "/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/vehicles", label: "Vehicles", icon: Bike },
  { href: "/reminders", label: "Reminders", icon: AlarmClock },
  { href: "/accessories", label: "Accessories", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users, roles: ["owner", "manager"] },
  { href: "/audit", label: "Audit", icon: ScrollText, roles: ["owner"] },
];

export function AppShell({
  session,
  notificationCount = 0,
  children,
}: {
  session: { fullName: string; role: Role; username: string };
  notificationCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.roles || n.roles.includes(session.role));
  const initials = session.fullName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* Mobile overlay */}
      {open && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-surface",
          "transition-transform duration-200 ease-out md:sticky",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" onClick={() => setOpen(false)}>
            <Image src="/logo.png" alt="" width={32} height={32} className="shrink-0 rounded-lg" priority />
            <span className="truncate font-semibold tracking-tight">ProBikes</span>
          </Link>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2 md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <div className="px-2 pb-2 text-[10px] font-medium tracking-wider uppercase text-muted-2">
            Menu
          </div>
          <ul className="flex flex-col gap-0.5">
            {items.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-row items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-primary-soft font-medium text-primary" : "text-muted",
                    )}
                  >
                    <Icon size={17} strokeWidth={active ? 2.25 : 2} />
                    <span className="truncate">{n.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User + signout */}
        <div className="flex items-center gap-2 border-t border-border px-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{session.fullName}</div>
            <div className="text-[10px] text-muted capitalize">{session.role}</div>
          </div>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border px-4 backdrop-blur md:px-6"
          style={{ background: "color-mix(in srgb, var(--c-bg) 80%, transparent)" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface-2 md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="truncate text-sm font-medium">
              {capitalize(pathname.split("/")[1] || "Dashboard")}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell initialCount={notificationCount} />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
