import { describe, expect, it } from "vitest";
import { parseListParams, listHref, PAGE_SIZE } from "./pagination";

const SORTABLE = ["refNumber", "customerName", "createdAt"] as const;

describe("parseListParams", () => {
  it("defaults to page 1 and the given default sort", () => {
    const p = parseListParams({}, SORTABLE, { field: "createdAt", dir: "desc" });
    expect(p).toMatchObject({ page: 1, sort: "createdAt", dir: "desc", skip: 0, take: PAGE_SIZE });
    expect(p.orderBy).toEqual({ createdAt: "desc" });
  });

  it("reads page, sort and dir from a URLSearchParams", () => {
    const sp = new URLSearchParams("page=3&sort=customerName&dir=asc");
    const p = parseListParams(sp, SORTABLE, { field: "createdAt", dir: "desc" });
    expect(p).toMatchObject({ page: 3, sort: "customerName", dir: "asc" });
    expect(p.skip).toBe(2 * PAGE_SIZE);
  });

  it("rejects sort fields outside the whitelist (no Prisma injection)", () => {
    const sp = new URLSearchParams("sort=passwordHash; DROP TABLE users");
    const p = parseListParams(sp, SORTABLE, { field: "createdAt", dir: "desc" });
    expect(p.sort).toBe("createdAt");
  });

  it("rejects invalid dir values", () => {
    const sp = new URLSearchParams("dir=sideways");
    const p = parseListParams(sp, SORTABLE, { field: "createdAt", dir: "desc" });
    expect(p.dir).toBe("desc");
  });

  it("clamps page to a minimum of 1 and ignores junk", () => {
    expect(parseListParams({ page: "0" }, SORTABLE, { field: "createdAt", dir: "desc" }).page).toBe(1);
    expect(parseListParams({ page: "abc" }, SORTABLE, { field: "createdAt", dir: "desc" }).page).toBe(1);
    expect(parseListParams({ page: "-3" }, SORTABLE, { field: "createdAt", dir: "desc" }).page).toBe(1);
  });

  it("accepts a plain record (Next.js searchParams shape)", () => {
    const p = parseListParams({ page: "2", sort: "refNumber", dir: "asc" }, SORTABLE, { field: "createdAt", dir: "desc" });
    expect(p).toMatchObject({ page: 2, sort: "refNumber", dir: "asc" });
  });

  it("honours a custom page size", () => {
    const p = parseListParams({ page: "2" }, SORTABLE, { field: "createdAt", dir: "desc" }, 50);
    expect(p.take).toBe(50);
    expect(p.skip).toBe(50);
  });
});

describe("listHref", () => {
  it("patches params and preserves siblings", () => {
    const sp = new URLSearchParams("q=activa&status=booked&page=4");
    expect(listHref(sp, { sort: "startAt", dir: "desc" })).toBe("?q=activa&status=booked&sort=startAt&dir=desc");
  });

  it("resets page unless the patch sets it explicitly", () => {
    const sp = new URLSearchParams("page=5&q=x");
    expect(listHref(sp, { dir: "asc" })).not.toContain("page=");
    expect(listHref(sp, { page: "9" })).toContain("page=9");
  });

  it("undefined patch values delete the param", () => {
    const sp = new URLSearchParams("status=booked&page=2");
    expect(listHref(sp, { status: undefined })).not.toContain("status=");
  });

  it("returns a bare ? when nothing is left", () => {
    expect(listHref(new URLSearchParams("page=2"), { page: undefined })).toBe("?");
  });
});
