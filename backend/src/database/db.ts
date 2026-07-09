import duckdb from "duckdb";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, "../../../duckdb");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const dbPath = path.join(DB_DIR, "ephemeris.db");
console.log(`[Database] Initializing persistent DuckDB instance at: ${dbPath}`);

export const db = new duckdb.Database(dbPath);
export const connection = db.connect();

/**
 * Promisified query helper for clean async/await execution
 */
export const query = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    connection.all(sql, ...params, (err, rows) => {
      if (err) {
        console.error(`[Database Error] SQL Execution failed: ${sql}`, err);
        return reject(err);
      }
      resolve(rows);
    });
  });
};

/**
 * Initializes configuration, boots spatial extensions, and flattens tracking data
 */
export const initDatabase = async (): Promise<void> => {
  try {
    console.log("[Database] Loading spatial extensions...");
    await query("INSTALL spatial;");
    await query("LOAD spatial;");
    console.log("[Database] DuckDB Spatial extension ready.");

    const dataFilePath = path.resolve(
      __dirname,
      "../../../data/Altair-2P5S-tracks-1w.json",
    );
    const normalizedDataPath = dataFilePath.replace(/\\/g, "/");

    if (!fs.existsSync(dataFilePath)) {
      console.warn(
        `[Database Warning] Telemetry file missing at ${dataFilePath}. Skipping auto-ingestion.`,
      );
      return;
    }

    // Clear out old states
    await query("DROP TABLE IF EXISTS passes;");
    await query("DROP TABLE IF EXISTS staging_json_table;");

    console.log("[Database] Scanning JSON data hierarchy fields...");

    // Force immediate schema materialization into a temporary table
    await query(`
      CREATE TEMP TABLE staging_json_table AS
      SELECT * FROM read_json_auto('${normalizedDataPath}', maximum_object_size=100000000);
    `);

    // Corrected column lookup field to 'name'
    const columns = await query(
      "SELECT name FROM pragma_table_info('staging_json_table');",
    );
    const columnNames = columns.map((c) => c.name);

    let targetArrayField = "";
    if (columnNames.includes("features")) targetArrayField = "features";
    else if (columnNames.includes("tracks")) targetArrayField = "tracks";
    else if (columnNames.includes("data")) targetArrayField = "data";

    // Builds `passes`: typed columns (satellite, ts_start, ts_end, local_time_h)
    // plus a GEOMETRY column, instead of a single JSON blob column.
    //
    // Geometry is built directly from the coordinate list via ST_MakeLine/ST_Point
    // rather than parsed through ST_GeomFromGeoJSON keyed on geometry.type. That
    // matters because 1,134 of 100,810 features are labeled "MultiLineString" but
    // their coordinates are structurally flat position lists (one nesting level
    // short of a real MultiLineString) -- they're mislabeled LineStrings. Every
    // feature's coordinates are, in practice, a flat list of [lon, lat, alt]
    // positions, so building the LINESTRING straight from that list handles all
    // rows -- malformed label or not -- uniformly, with altitude dropped for a 2D
    // geometry.
    if (targetArrayField) {
      console.log(
        `[Database] Unpacking telemetry array via field: "${targetArrayField}"...`,
      );
      await query(`
        CREATE TABLE passes AS
        SELECT
          feature.properties.satellite::VARCHAR AS satellite,
          feature.properties.ts_start::TIMESTAMP AS ts_start,
          feature.properties.ts_end::TIMESTAMP AS ts_end,
          feature.properties.local_time_h::DOUBLE AS local_time_h,
          ST_MakeLine(
            list_transform(feature.geometry.coordinates, pos -> ST_Point(pos[1], pos[2]))
          ) AS geom
        FROM (
          SELECT unnest(${targetArrayField}) AS feature FROM staging_json_table
        );
      `);
    } else {
      console.log(
        "[Database] File layout is flat. Migrating records directly...",
      );
      await query(`
        CREATE TABLE passes AS
        SELECT
          properties.satellite::VARCHAR AS satellite,
          properties.ts_start::TIMESTAMP AS ts_start,
          properties.ts_end::TIMESTAMP AS ts_end,
          properties.local_time_h::DOUBLE AS local_time_h,
          ST_MakeLine(
            list_transform(geometry.coordinates, pos -> ST_Point(pos[1], pos[2]))
          ) AS geom
        FROM staging_json_table;
      `);
    }

    // Clean up temporary memory table
    await query("DROP TABLE IF EXISTS staging_json_table;");

    const countCheck = await query("SELECT COUNT(*) as total FROM passes;");
    console.log(
      `[Database] Success! Ingested ${countCheck[0].total} satellite passes into native spatial storage.`,
    );
  } catch (error) {
    console.error("[Database] Critical initialization failure:", error);
    process.exit(1);
  }
};
