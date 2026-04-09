import { collectionDefinitions, managedCollectionNames } from "./collections/definitions.mjs";

async function hasCollection(db, name) {
  const matches = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return matches.length > 0;
}

async function ensureCollection(db, definition) {
  const exists = await hasCollection(db, definition.name);

  if (!exists) {
    await db.createCollection(definition.name, {
      validator: definition.validator,
      validationLevel: "strict",
      validationAction: "error"
    });
    return { name: definition.name, action: "created" };
  }

  await db.command({
    collMod: definition.name,
    validator: definition.validator,
    validationLevel: "strict",
    validationAction: "error"
  });

  return { name: definition.name, action: "updated" };
}

async function ensureIndexes(db, definition) {
  const collection = db.collection(definition.name);
  const created = [];

  for (const indexDefinition of definition.indexes) {
    const name = await collection.createIndex(indexDefinition.key, indexDefinition.options);
    created.push(name);
  }

  return created;
}

export async function initializeDatabase(db) {
  const results = [];

  for (const definition of collectionDefinitions) {
    const collectionResult = await ensureCollection(db, definition);
    const indexes = await ensureIndexes(db, definition);
    results.push({
      collection: definition.name,
      action: collectionResult.action,
      indexes
    });
  }

  return results;
}

export async function dropManagedCollections(db) {
  const existing = await db
    .listCollections(
      {
        name: { $in: managedCollectionNames }
      },
      { nameOnly: true }
    )
    .toArray();

  for (const { name } of existing) {
    await db.collection(name).drop();
  }

  return existing.map((collection) => collection.name);
}

export { managedCollectionNames };
