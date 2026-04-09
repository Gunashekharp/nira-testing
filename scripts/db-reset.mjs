import { closeMongoClient, getDatabase, getDbConfig } from "../db/lib/mongo.mjs";
import { dropManagedCollections, initializeDatabase } from "../db/setup.mjs";
import { seedDatabase } from "../db/seed/seedDatabase.mjs";

async function main() {
  const db = await getDatabase();
  const config = getDbConfig();
  const droppedCollections = await dropManagedCollections(db);
  const initialized = await initializeDatabase(db);
  const seeded = await seedDatabase(db, { ensureSchema: false, clearSessions: true });

  console.log(`Connected to ${config.dbName} at ${config.uri}`);
  console.log(
    droppedCollections.length
      ? `Dropped collections: ${droppedCollections.join(", ")}`
      : "Dropped collections: none"
  );
  console.log(`Reinitialized collections: ${initialized.length}`);
  console.log(`Reseeded collections: ${seeded.collectionResults.length}`);
}

main()
  .catch((error) => {
    console.error("Failed to reset NIRA MongoDB schema.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
