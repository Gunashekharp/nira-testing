import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSeedState } from "../data/seed";

function createSupabaseApiMock({ configured = false, remoteState = null } = {}) {
  const fetchAppStateSnapshot = vi.fn().mockResolvedValue(remoteState);
  const persistAppStateSnapshot = vi.fn().mockResolvedValue({
    synced: true,
    skipped: false,
    snapshotKey: "primary"
  });

  return {
    fetchAppStateSnapshot,
    persistAppStateSnapshot,
    module: {
      appStateSnapshotConfigured: configured,
      approvePrescription: vi.fn(),
      createNotification: vi.fn(),
      createEncounter: vi.fn(),
      createInterview: vi.fn(),
      createPrecheckQuestionnaire: vi.fn(),
      createPrescription: vi.fn(),
      fetchAppStateSnapshot,
      persistAppStateSnapshot,
      syncSignupToDatabase: vi.fn(),
      updateInterview: vi.fn(),
      upsertEncounterSnapshot: vi.fn(),
      upsertLabReport: vi.fn(),
      upsertTestOrder: vi.fn()
    }
  };
}

async function loadDemoStore(options) {
  vi.resetModules();
  const supabaseApiMock = createSupabaseApiMock(options);

  vi.doMock("../services/supabaseApi", () => supabaseApiMock.module);

  const demoStoreModule = await import("../services/demoStore");
  return {
    ...demoStoreModule,
    ...supabaseApiMock
  };
}

async function flushAsyncQueue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.resetModules();
  vi.unmock("../services/supabaseApi");
});

test("demoStore stays localStorage-only when remote snapshot sync is disabled", async () => {
  const { demoStore, STORAGE_KEY, fetchAppStateSnapshot, persistAppStateSnapshot } = await loadDemoStore({
    configured: false
  });

  const snapshot = await demoStore.getState();
  demoStore.reset();
  await flushAsyncQueue();

  expect(fetchAppStateSnapshot).not.toHaveBeenCalled();
  expect(persistAppStateSnapshot).not.toHaveBeenCalled();
  expect(snapshot).toEqual(expect.objectContaining({ meta: expect.any(Object) }));
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toEqual(
    expect.objectContaining({ meta: expect.any(Object) })
  );
});

test("demoStore hydrates from the configured remote snapshot and persists later writes", async () => {
  const remoteState = structuredClone(createSeedState());
  remoteState.meta.today = "2026-04-20";
  remoteState.meta.lastSyncedAt = "2026-04-20T09:30:00.000Z";

  const { demoStore, STORAGE_KEY, fetchAppStateSnapshot, persistAppStateSnapshot } = await loadDemoStore({
    configured: true,
    remoteState
  });

  const hydrated = await demoStore.getState();
  await demoStore.getState();

  expect(fetchAppStateSnapshot).toHaveBeenCalledTimes(1);
  expect(hydrated.meta.today).toBe("2026-04-20");
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).meta.today).toBe("2026-04-20");

  demoStore.reset();
  await flushAsyncQueue();

  expect(persistAppStateSnapshot).toHaveBeenCalled();
  expect(persistAppStateSnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({
      meta: expect.objectContaining({
        lastSyncedAt: expect.any(String)
      })
    })
  );
});
