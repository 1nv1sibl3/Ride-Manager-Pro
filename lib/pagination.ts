// URL-driven list pagination + sorting. Pure functions — unit-tested in
// lib/pagination.test.ts. Sort fields are whitelisted per page so arbitrary
// ?sort= values can't leak into Prisma queries.

export const PAGE_SIZE = 25;

export type SortDir = "asc" | "desc";

export type ListParams = {
  page: number;
  sort: string;
  dir: SortDir;
  skip: number;
  take: number;
  orderBy: Record<string, unknown>;
};

export function parseListParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  sortable: readonly string[],
  defaultSort: { field: string; dir: SortDir },
  pageSize = PAGE_SIZE,
): ListParams {
  const get = (key: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, Number.parseInt(get("page") || "1", 10) || 1);
  const sortRaw = get("sort") ?? defaultSort.field;
  const sort = (sortable as readonly string[]).includes(sortRaw) ? sortRaw : defaultSort.field;
  const dir: SortDir = get("dir") === "asc" ? "asc" : get("dir") === "desc" ? "desc" : defaultSort.dir;

  return {
    page,
    sort,
    dir,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { [sort]: dir },
  };
}

/** Builds an href that preserves sibling params (q, status, …) and resets page on sort change. */
export function listHref(
  current: URLSearchParams,
  patch: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) next.delete(key);
    else next.set(key, value);
  }
  if (!("page" in patch)) next.delete("page"); // sort/filter changes reset paging
  const qs = next.toString();
  return qs ? `?${qs}` : "?";
}
