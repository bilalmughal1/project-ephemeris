import { Request, Response } from "express";
import { query } from "../database/db.js";

export const getPasses = async (req: Request, res: Response) => {
  try {
    const satellitesParam = req.query.satellites as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (satellitesParam) {
      const satellites = satellitesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (satellites.length > 0) {
        const placeholders = satellites.map(() => "?").join(", ");
        conditions.push(`satellite IN (${placeholders})`);
        params.push(...satellites);
      }
    }

    // Interval overlap, not start-time containment: a pass matches if it
    // starts before the window ends AND ends after the window starts.
    if (to) {
      conditions.push("ts_start <= ?");
      params.push(to);
    }
    if (from) {
      conditions.push("ts_end >= ?");
      params.push(from);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        ST_AsGeoJSON(geom) AS geometry_json,
        satellite,
        ts_start,
        ts_end,
        local_time_h
      FROM passes
      ${whereClause};
    `;

    const rows = await query(sql, params);

    const featureCollection = {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry:
          typeof row.geometry_json === "string"
            ? JSON.parse(row.geometry_json)
            : row.geometry_json,
        properties: {
          satellite: row.satellite,
          ts_start: row.ts_start,
          ts_end: row.ts_end,
          local_time_h: row.local_time_h,
        },
      })),
    };

    const jsonOutput = JSON.stringify(featureCollection, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );

    res.setHeader("Content-Type", "application/json");
    return res.send(jsonOutput);
  } catch (error) {
    console.error("[API Error] Failed to filter satellite passes:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error filtering satellite passes." });
  }
};
