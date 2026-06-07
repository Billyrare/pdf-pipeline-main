import pg from "pg";
import { env } from "./config.js";

const pool = new pg.Pool({
  connectionString: env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

export async function initDb() {
  try {
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cert_storage (
        pdf_id TEXT PRIMARY KEY,
        converted_json JSONB
      )
    `);
    console.log("Database initialized");
  } catch (error) {
    console.error("Database initialization failed", error);
    throw error;
  }
}

export async function isAlreadyConverted(id) {
  const { rows } = await pool.query(
    "SELECT 1 FROM cert_storage WHERE pdf_id = $1 AND converted_json IS NOT NULL",
    [id],
  );

  return rows.length > 0;
}

export async function saveResult(id, jsonData) {
  await pool.query(
    `INSERT INTO cert_storage (pdf_id, converted_json)
     VALUES ($1, $2)
     ON CONFLICT (pdf_id)
     DO UPDATE SET converted_json = EXCLUDED.converted_json`,
    [id, JSON.stringify(jsonData)],
  );
}

export async function closeDb() {
  await pool.end();
}
