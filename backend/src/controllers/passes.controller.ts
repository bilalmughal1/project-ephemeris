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

export const searchPasses = async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat(req.query.radius_km as string);

    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radiusKm)) {
      return res.status(400).json({
        error:
          "lat, lng, and radius_km are required numeric query parameters.",
      });
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const satellitesParam = req.query.satellites as string | undefined;

    // Great-circle surface distance, not degree distance: ST_Distance_Sphere
    // returns meters, so radius_km is converted before binding.
    //
    // ST_Distance_Sphere(GEOMETRY, GEOMETRY) throws in this DuckDB spatial
    // build the moment either argument is a LINESTRING rather than a POINT
    // (verified directly: point-to-point calls work, LINESTRING input throws
    // "Unknown exception in ExecutorTask::Execute" even with explicit
    // ::GEOMETRY casts on both sides). Every pass has exactly 7 sampled track
    // vertices (verified at ingest), so distance-to-track is computed as the
    // minimum great-circle distance to any of its 7 vertices via ST_PointN +
    // point-to-point ST_Distance_Sphere, both confirmed working. This is
    // still true great-circle math throughout -- no planar/degree distance --
    // but can overestimate the true point-to-line distance by up to roughly
    // half the inter-vertex spacing (~70km in this dataset, so ~35km worst
    // case), since it measures to the nearest sampled point rather than the
    // nearest point along the line itself.
    const params: unknown[] = [lng, lat, radiusKm * 1000];
    const conditions: string[] = [
      `LEAST(
        ST_Distance_Sphere(ST_PointN(geom, 1), click.pt),
        ST_Distance_Sphere(ST_PointN(geom, 2), click.pt),
        ST_Distance_Sphere(ST_PointN(geom, 3), click.pt),
        ST_Distance_Sphere(ST_PointN(geom, 4), click.pt),
        ST_Distance_Sphere(ST_PointN(geom, 5), click.pt),
        ST_Distance_Sphere(ST_PointN(geom, 6), click.pt),
        ST_Distance_Sphere(ST_PointN(geom, 7), click.pt)
      ) <= ?`,
    ];

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

    // Interval overlap, same semantics as GET /api/passes.
    if (to) {
      conditions.push("ts_start <= ?");
      params.push(to);
    }
    if (from) {
      conditions.push("ts_end >= ?");
      params.push(from);
    }

    const sql = `
      WITH click AS (SELECT ST_Point(?, ?) AS pt)
      SELECT
        ST_AsGeoJSON(geom) AS geometry_json,
        satellite,
        ts_start,
        ts_end,
        local_time_h
      FROM passes, click
      WHERE ${conditions.join(" AND ")};
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
    console.error("[API Error] Failed to search satellite passes:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error searching satellite passes." });
  }
};
