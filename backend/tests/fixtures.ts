import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Request, Response } from "express";

interface FixturePass {
  satellite: string;
  ts_start: string;
  ts_end: string;
  local_time_h: number;
  center: [number, number]; // [lon, lat] -- all 7 track vertices are cloned here
}

// Same 5-pass fixture backs every test group. Each pass's local_time_h is a
// unique numeric id, used to assert presence/absence without depending on
// how DuckDB's TIMESTAMP columns get serialized.
export const FIXTURE_PASSES: FixturePass[] = [
  {
    // Straddles the [from, to] test window: starts before `from`, ends
    // inside it. Proves interval-overlap semantics, not start-time
    // containment.
    satellite: "SAT-A",
    ts_start: "2026-01-01T12:00:00Z",
    ts_end: "2026-01-02T06:00:00Z",
    local_time_h: 10.5,
    center: [100, 50],
  },
  {
    // Entirely before the test window -- must be excluded by the time filter.
    satellite: "SAT-A",
    ts_start: "2025-12-30T00:00:00Z",
    ts_end: "2025-12-31T00:00:00Z",
    local_time_h: 8,
    center: [100, 50],
  },
  {
    // Fully inside the test window; distinct satellite for the satellite filter.
    satellite: "SAT-B",
    ts_start: "2026-01-02T02:00:00Z",
    ts_end: "2026-01-02T04:00:00Z",
    local_time_h: 12,
    center: [100, 50],
  },
  {
    // Clustered at the spatial test's click point -- must be within radius.
    satellite: "SAT-C",
    ts_start: "2026-01-02T01:00:00Z",
    ts_end: "2026-01-02T05:00:00Z",
    local_time_h: 9,
    center: [10, 10],
  },
  {
    // ~777km from the spatial test's click point (verified via ST_Distance_Sphere)
    // -- must be excluded by a 50km radius.
    satellite: "SAT-D",
    ts_start: "2026-01-02T01:00:00Z",
    ts_end: "2026-01-02T05:00:00Z",
    local_time_h: 11,
    center: [15, 15],
  },
];

function buildFixtureFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: FIXTURE_PASSES.map((p) => ({
      type: "Feature",
      properties: {
        satellite: p.satellite,
        ts_start: p.ts_start,
        ts_end: p.ts_end,
        local_time_h: p.local_time_h,
      },
      geometry: {
        type: "LineString",
        // 7 identical vertices: production's ST_PointN(geom, 1..7) spatial
        // search assumes every pass has exactly 7 sampled track vertices.
        coordinates: Array.from({ length: 7 }, () => [
          p.center[0],
          p.center[1],
          500,
        ]),
      },
    })),
  };
}

export interface TestDb {
  getPasses: (req: Request, res: Response) => Promise<unknown>;
  searchPasses: (req: Request, res: Response) => Promise<unknown>;
  query: (sql: string, params?: unknown[]) => Promise<any[]>;
  cleanup: () => Promise<void>;
}

export async function setupTestDb(): Promise<TestDb> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ephemeris-data-"));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "ephemeris-db-"));

  fs.writeFileSync(
    path.join(dataDir, "Altair-2P5S-tracks-1w.json"),
    JSON.stringify(buildFixtureFeatureCollection()),
  );

  process.env.DATA_DIR = dataDir;
  process.env.DB_DIR = dbDir;

  // Dynamic import so db.ts's module-scope DATA_DIR/DB_DIR resolution picks
  // up the env vars set above. Must not be statically imported anywhere
  // earlier in this process, or it binds to the production default paths.
  const dbModule = await import("../src/database/db.js");
  await dbModule.initDatabase();

  const controller = await import("../src/controllers/passes.controller.js");

  return {
    getPasses: controller.getPasses,
    searchPasses: controller.searchPasses,
    query: dbModule.query,
    cleanup: async () => {
      // DuckDB holds an open file handle on the db file until closed;
      // removing the temp dir first fails with EPERM on Windows.
      await new Promise<void>((resolve, reject) =>
        dbModule.connection.close((err) => (err ? reject(err) : resolve())),
      );
      await new Promise<void>((resolve, reject) =>
        dbModule.db.close((err) => (err ? reject(err) : resolve())),
      );
      fs.rmSync(dataDir, { recursive: true, force: true });
      try {
        // On Windows, the duckdb binding's close() callback can resolve
        // before the OS actually releases the file handle on the .db file
        // (verified: persists past a 3s wait even after close() succeeds).
        // Harmless -- it's an OS temp dir the OS will reclaim -- so warn
        // instead of failing the suite over it.
        fs.rmSync(dbDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      } catch (err) {
        console.warn(
          `[test cleanup] Could not remove temp DB dir ${dbDir} (Windows file lock on the closed duckdb handle). Leaving it for the OS to reclaim.`,
          err,
        );
      }
    },
  };
}

export function mockReq(query: Record<string, string>): Request {
  return { query } as unknown as Request;
}

export function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    setHeader() {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(payload: string) {
      res.body = JSON.parse(payload);
      return res;
    },
  };
  return res as unknown as Response & typeof res;
}
