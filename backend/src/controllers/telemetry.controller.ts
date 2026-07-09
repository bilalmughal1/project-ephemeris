import { Request, Response } from "express";
import { query } from "../database/db.js";

export const getTelemetryData = async (req: Request, res: Response) => {
  try {
    // Standard pagination settings via query params (defaults: page 1, 100 records per page)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;

    console.log(`[API] Streaming telemetry page ${page} (Limit: ${limit})`);

    // Fetch the native unnested frames directly
    const dataSql = `
      SELECT telemetry_frame 
      FROM satellite_telemetry
      LIMIT ? OFFSET ?;
    `;

    const countSql = `SELECT COUNT(*) as total FROM satellite_telemetry;`;

    // Run database queries concurrently
    const [records, countResult] = await Promise.all([
      query(dataSql, [limit, offset]),
      query(countSql),
    ]);

    // Explicitly cast DuckDB's BigInt count to a native JS Number to allow arithmetic operations
    const totalRecords = Number(countResult[0].total);
    const totalPages = Math.ceil(totalRecords / limit);

    // Build the structural response envelope
    const responsePayload = {
      meta: {
        totalRecords,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: records.map((row) => {
        const frame =
          typeof row.telemetry_frame === "string"
            ? JSON.parse(row.telemetry_frame)
            : row.telemetry_frame;

        return {
          type: frame?.type || "Feature",
          properties: frame?.properties || {},
          geometry: frame?.geometry || {},
        };
      }),
    };

    // Serialize cleanly using a custom replacer to prevent JSON stringify crashes on BigInt types
    const jsonOutput = JSON.stringify(responsePayload, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );

    // Ship the response down the wire explicitly as JSON
    res.setHeader("Content-Type", "application/json");
    return res.send(jsonOutput);
  } catch (error) {
    console.error("[API Error] Failed to stream telemetry frames:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error streaming tracking layout." });
  }
};
