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
    await query("DROP TABLE IF EXISTS satellite_telemetry;");
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

    if (targetArrayField) {
      console.log(
        `[Database] Unpacking telemetry array via field: "${targetArrayField}"...`,
      );
      // Burst the nested track array into individual rows
      await query(`
        CREATE TABLE satellite_telemetry AS 
        SELECT unnest(${targetArrayField}) as telemetry_frame 
        FROM staging_json_table;
      `);
    } else {
      console.log(
        "[Database] File layout is flat. Migrating records directly...",
      );
      await query(`
        CREATE TABLE satellite_telemetry AS 
        SELECT * FROM staging_json_table;
      `);
    }

    // Clean up temporary memory table
    await query("DROP TABLE IF EXISTS staging_json_table;");

    const countCheck = await query(
      "SELECT COUNT(*) as total FROM satellite_telemetry;",
    );
    console.log(
      `[Database] Success! Ingested ${countCheck[0].total} individual telemetry tracking frames into native storage.`,
    );
  } catch (error) {
    console.error("[Database] Critical initialization failure:", error);
    process.exit(1);
  }
};
