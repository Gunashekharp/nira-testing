import { closeMongoClient, getDatabase, getDbConfig } from "../db/lib/mongo.mjs";
import { initializeDatabase } from "../db/setup.mjs";

async function main() {
  const db = await getDatabase();
  const config = getDbConfig();
  const results = await initializeDatabase(db);

  console.log(`Connected to ${config.dbName} at ${config.uri}`);
  console.log("Initialized MongoDB collections and indexes:");

  for (const result of results) {
    console.log(`- ${result.collection}: ${result.action} (${result.indexes.length} indexes)`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to initialize NIRA MongoDB schema.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
