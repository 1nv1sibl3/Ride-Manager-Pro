"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Sortable table header. Sort state lives in the URL (?sort=&dir=) so it is
 * shareable and works with server-side sorting. Clicking a new column starts
 * ascending; clicking the active column toggles direction. Changing sort
 * resets ?page.
 */
export function Th({
  field,
  label,
  align = "left",
  className,
}: {
  field?: string;
  label: string;
  align?: "left" | "right";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const sortable = !!field;
  const active = sortable && sp.get("sort") === field;
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";

  function onClick() {
    if (!field) return;
    const next = new URLSearchParams(sp.toString());
    next.set("sort", field);
    next.set("dir", active && dir === "asc" ? "desc" : "asc");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <th className={className} style={{ textAlign: align }}>
      {sortable ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-fg",
            active && "text-fg",
          )}
          aria-label={`Sort by ${label}`}
        >
          {label}
          <Icon size={11} className={active ? "opacity-100" : "opacity-30"} />
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/** Prev/next pager driven by ?page= in the URL. Renders nothing for a single page. */
export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (pages <= 1) return null;

  function go(p: number) {
    if (p < 1 || p > pages || p === page) return;
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-3 text-xs text-muted">
      <div className="num">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronLeft size={13} /> Prev
        </Button>
        <span className="num px-1">
          Page {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">
          Next <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  );
}
