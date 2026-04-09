import { closeMongoClient, getDatabase, getDbConfig } from "../db/lib/mongo.mjs";
import { seedDatabase } from "../db/seed/seedDatabase.mjs";

function printCredentials(credentials) {
  console.log("Seed credentials:");
  for (const credential of credentials) {
    const suffix = credential.status ? ` [${credential.status}]` : "";
    console.log(`- ${credential.role}: ${credential.login} / ${credential.password}${suffix}`);
  }
}

async function main() {
  const db = await getDatabase();
  const config = getDbConfig();
  const result = await seedDatabase(db, { ensureSchema: true, clearSessions: true });

  console.log(`Connected to ${config.dbName} at ${config.uri}`);
  console.log("Seeded NIRA operational collections:");

  for (const entry of result.collectionResults) {
    console.log(
      `- ${entry.collection}: ${entry.documentCount} docs (upserted ${entry.upsertedCount}, modified ${entry.modifiedCount})`
    );
  }

  console.log(`- auth_sessions cleared: ${result.clearedSessionCount}`);
  printCredentials(result.credentials);
}

main()
  .catch((error) => {
    console.error("Failed to seed NIRA MongoDB data.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
