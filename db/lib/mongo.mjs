import { MongoClient, ServerApiVersion } from "mongodb";
import { getDbEnv } from "./env.mjs";

let clientPromise;

function createClient() {
  const { uri } = getDbEnv();

  return new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
}

export function getDbConfig() {
  return getDbEnv();
}

export async function getMongoClient() {
  if (!clientPromise) {
    const client = createClient();
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  const { dbName } = getDbConfig();
  return client.db(dbName);
}

export async function closeMongoClient() {
  if (!clientPromise) {
    return;
  }

  const client = await clientPromise;
  await client.close();
  clientPromise = null;
}
