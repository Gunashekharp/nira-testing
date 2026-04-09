import fs from "node:fs";
import path from "node:path";

const ENV_FILES = [".env.local", ".env"];

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadLocalEnv(cwd = process.cwd()) {
  const loaded = {};

  for (const fileName of ENV_FILES) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
      loaded[key] = process.env[key];
    }
  }

  return loaded;
}

export function getDbEnv() {
  loadLocalEnv();

  return {
    uri: process.env.NIRA_MONGODB_URI || "mongodb://127.0.0.1:27017",
    dbName: process.env.NIRA_MONGODB_DB_NAME || "nira_db"
  };
}
