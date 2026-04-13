import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "supabase", "migrations", "001_emr_schema.sql"), "utf8");

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("Connecting to Supabase DB...");
  await client.connect();
  console.log("Running migration...");
  await client.query(sql);
  console.log("Migration complete!");
  await client.end();
}

run().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
