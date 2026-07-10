import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, createMockRes, mockReq, type TestDb } from "./fixtures.js";

let ctx: TestDb;

function localTimeHs(body: any): number[] {
  return body.features.map((f: any) => f.properties.local_time_h);
}

beforeAll(async () => {
  ctx = await setupTestDb();
}, 30000);

afterAll(async () => {
  await ctx.cleanup();
});

describe("GET /api/passes -- time-window filter (interval overlap)", () => {
  const from = "2026-01-02T00:00:00Z";
  const to = "2026-01-03T00:00:00Z";

  it("includes a pass that starts before `from` but ends inside the window", async () => {
    const res = createMockRes();
    await ctx.getPasses(mockReq({ from, to }), res);

    expect(res.statusCode).toBe(200);
    expect(localTimeHs(res.body)).toContain(10.5);
  });

  it("excludes a pass entirely before the window", async () => {
    const res = createMockRes();
    await ctx.getPasses(mockReq({ from, to }), res);

    expect(localTimeHs(res.body)).not.toContain(8);
  });
});

describe("GET /api/passes -- satellite filter", () => {
  it("returns only the requested satellite's passes", async () => {
    const res = createMockRes();
    await ctx.getPasses(mockReq({ satellites: "SAT-A" }), res);

    expect(localTimeHs(res.body).sort((a: number, b: number) => a - b)).toEqual([
      8, 10.5,
    ]);
  });

  it("returns all passes when no satellite filter is given", async () => {
    const res = createMockRes();
    await ctx.getPasses(mockReq({}), res);

    expect(localTimeHs(res.body).sort((a: number, b: number) => a - b)).toEqual([
      8, 9, 10.5, 11, 12,
    ]);
  });
});

describe("GET /api/passes/search -- spatial radius filter", () => {
  it("returns a pass within the radius and excludes one clearly outside it", async () => {
    const res = createMockRes();
    await ctx.searchPasses(
      mockReq({ lat: "10", lng: "10", radius_km: "50" }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(localTimeHs(res.body)).toEqual([9]);
  });
});

describe("GET /api/passes -- satellite filter is injection-safe", () => {
  it("treats a malicious satellites value as a literal string, not SQL", async () => {
    const res = createMockRes();
    await ctx.getPasses(
      mockReq({ satellites: "SAT-A'; DROP TABLE passes;--" }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.features).toHaveLength(0);
  });

  it("leaves the passes table intact after the attempted injection", async () => {
    const res = createMockRes();
    await ctx.getPasses(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.features).toHaveLength(5);

    const rows = await ctx.query("SELECT COUNT(*) AS n FROM passes;");
    expect(Number(rows[0].n)).toBe(5);
  });
});
