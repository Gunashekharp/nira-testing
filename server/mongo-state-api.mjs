import http from "node:http";
import { getDatabase, closeMongoClient, getDbConfig } from "../db/lib/mongo.mjs";

const PORT = Number(process.env.NIRA_MONGO_API_PORT || 7071);
const COLLECTION_NAME = "app_state_snapshots";
const SNAPSHOT_ID = "primary";

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON payload."));
      }
    });

    request.on("error", reject);
  });
}

async function getStateSnapshot(db) {
  const snapshot = await db.collection(COLLECTION_NAME).findOne({ _id: SNAPSHOT_ID });
  return snapshot?.state || null;
}

async function saveStateSnapshot(db, state) {
  const now = new Date();
  await db.collection(COLLECTION_NAME).updateOne(
    { _id: SNAPSHOT_ID },
    {
      $set: {
        state,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );
}

async function createServer() {
  const db = await getDatabase();
  const config = getDbConfig();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "OPTIONS") {
      writeJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        dbName: config.dbName,
        collection: COLLECTION_NAME
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      const state = await getStateSnapshot(db);
      if (!state) {
        writeJson(response, 404, { ok: false, message: "No snapshot found." });
        return;
      }

      writeJson(response, 200, { ok: true, state });
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/state") {
      let body;
      try {
        body = await parseRequestBody(request);
      } catch (error) {
        writeJson(response, 400, { ok: false, message: error.message });
        return;
      }

      if (!body || typeof body.state !== "object" || body.state === null) {
        writeJson(response, 400, { ok: false, message: "state object is required." });
        return;
      }

      await saveStateSnapshot(db, body.state);
      writeJson(response, 200, { ok: true, syncedAt: new Date().toISOString() });
      return;
    }

    writeJson(response, 404, { ok: false, message: "Not found." });
  });

  server.listen(PORT, () => {
    console.log(`[NIRA] Mongo state API running at http://localhost:${PORT}`);
    console.log(`[NIRA] Connected to MongoDB database ${config.dbName}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closeMongoClient();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

createServer().catch((error) => {
  console.error("[NIRA] Failed to start Mongo state API.");
  console.error(error.message);
  process.exitCode = 1;
});