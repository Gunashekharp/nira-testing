import crypto from "node:crypto";
import { ObjectId } from "mongodb";

export function stableObjectId(seed) {
  const hex = crypto.createHash("md5").update(seed).digest("hex").slice(0, 24);
  return new ObjectId(hex);
}
