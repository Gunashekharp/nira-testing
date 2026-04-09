import { closeMongoClient, getDatabase, getDbConfig } from "../db/lib/mongo.mjs";
import { managedCollectionNames } from "../db/setup.mjs";

async function main() {
  const db = await getDatabase();
  const config = getDbConfig();
  const existingCollections = await db
    .listCollections(
      {
        name: { $in: managedCollectionNames }
      },
      { nameOnly: true }
    )
    .toArray();

  const existingNames = new Set(existingCollections.map((collection) => collection.name));

  console.log(`Connected to ${config.dbName} at ${config.uri}`);
  console.log("Managed collection status:");

  for (const name of managedCollectionNames) {
    if (!existingNames.has(name)) {
      console.log(`- ${name}: missing`);
      continue;
    }

    const [count, indexes] = await Promise.all([
      db.collection(name).countDocuments(),
      db.collection(name).indexes()
    ]);

    console.log(`- ${name}: ${count} documents, ${indexes.length} indexes`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to inspect NIRA MongoDB schema.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
