import { initializeDatabase } from "../setup.mjs";
import { buildSeedPayload } from "./sampleData.mjs";

function buildCollectionMap(payload) {
  return [
    { name: "clinics", documents: [payload.clinic] },
    {
      name: "users",
      documents: [
        payload.admin.user,
        ...payload.doctors.map((doctor) => doctor.user),
        ...payload.patients.map((patient) => patient.user)
      ]
    },
    {
      name: "patient_profiles",
      documents: payload.patients.map((patient) => patient.profile)
    },
    {
      name: "doctor_profiles",
      documents: payload.doctors.map((doctor) => doctor.profile)
    },
    { name: "admin_profiles", documents: [payload.admin.profile] },
    {
      name: "doctor_availability_templates",
      documents: payload.availabilityTemplates
    },
    { name: "doctor_day_schedules", documents: payload.daySchedules },
    { name: "appointments", documents: payload.appointments },
    { name: "encounters", documents: payload.encounters },
    { name: "prescriptions", documents: payload.prescriptions },
    { name: "audit_logs", documents: payload.auditLogs }
  ];
}

async function replaceDocuments(collection, documents) {
  if (!documents.length) {
    return {
      documentCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0
    };
  }

  const operations = documents.map((document) => ({
    replaceOne: {
      filter: { _id: document._id },
      replacement: document,
      upsert: true
    }
  }));

  const result = await collection.bulkWrite(operations, { ordered: true });

  return {
    documentCount: documents.length,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: result.upsertedCount
  };
}

export async function seedDatabase(db, options = {}) {
  const { ensureSchema = true, clearSessions = true, seedOptions = {} } = options;

  if (ensureSchema) {
    await initializeDatabase(db);
  }

  const payload = buildSeedPayload(seedOptions);
  const collectionMap = buildCollectionMap(payload);
  const collectionResults = [];

  for (const entry of collectionMap) {
    const result = await replaceDocuments(db.collection(entry.name), entry.documents);
    collectionResults.push({
      collection: entry.name,
      ...result
    });
  }

  let clearedSessionCount = 0;
  if (clearSessions) {
    const result = await db.collection("auth_sessions").deleteMany({});
    clearedSessionCount = result.deletedCount;
  }

  return {
    payload,
    credentials: payload.credentials,
    collectionResults,
    clearedSessionCount
  };
}
