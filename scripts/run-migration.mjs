import pg from "pg";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("Connecting to Supabase DB...");
  await client.connect();
  for (const file of migrationFiles) {
    console.log(`Running migration ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await client.query(sql);
  }
  console.log("Migration complete!");
  await client.end();
}

run().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
