import { beforeEach, expect, test, vi } from "vitest";

const { authSignUpMock, fromMock, invokeMock } = vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_STATE_SNAPSHOT_KEY", "primary");

  return {
    authSignUpMock: vi.fn(),
    fromMock: vi.fn(() => {
      const chain = {
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        upsert: vi.fn(() => chain),
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        single: vi.fn()
      };
      return chain;
    }),
    invokeMock: vi.fn()
  };
});

vi.mock("../lib/supabase", () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      signUp: authSignUpMock
    },
    functions: {
      invoke: invokeMock
    },
    from: fromMock
  }
}));

import {
  approvePrescription,
  createEncounter,
  createNotification,
  createPrescription,
  fetchAppStateSnapshot,
  persistAppStateSnapshot,
  updateInterview,
  upsertLabReport,
  upsertTestOrder
} from "../services/supabaseApi";

beforeEach(() => {
  invokeMock.mockReset();
});

test("createEncounter routes encounter persistence through care-sync", async () => {
  invokeMock.mockResolvedValue({ data: { id: "enc-123" }, error: null });

  await createEncounter({
    patientId: "patient-aasha",
    doctorId: "doctor-mehra",
    clinicId: "NIRA Pilot Clinic",
    appointmentId: "appointment-aasha",
    scheduledTime: "2026-04-10T09:15:00+05:30",
    type: "opd",
    chiefComplaint: "Fever"
  });

  expect(invokeMock).toHaveBeenCalledWith(
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "upsert_encounter",
        appointmentId: "appointment-aasha",
        chiefComplaint: "Fever"
      })
    })
  );
});

test("updateInterview normalizes completion status before care-sync", async () => {
  invokeMock.mockResolvedValue({ data: { id: "interview-123" }, error: null });

  await updateInterview("interview-123", {
    appointmentId: "appointment-aasha",
    encounterId: "enc-123",
    patientId: "patient-aasha",
    language: "en",
    completion_status: "complete",
    transcript: [{ role: "patient", text: "I have fever" }],
    ai_summary: { chiefComplaint: "Fever" }
  });

  expect(invokeMock).toHaveBeenCalledWith(
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "upsert_interview",
        interviewId: "interview-123",
        status: "completed",
        transcript: [{ role: "patient", text: "I have fever" }],
        aiSummary: { chiefComplaint: "Fever" }
      })
    })
  );
});

test("prescription helpers use care-sync actions", async () => {
  invokeMock.mockResolvedValue({ data: { id: "rx-db-1" }, error: null });

  await createPrescription({
    prescriptionId: "rx-appointment-aasha",
    appointmentId: "appointment-aasha",
    encounterId: "enc-123",
    patientId: "patient-aasha",
    doctorId: "doctor-mehra",
    clinicId: "NIRA Pilot Clinic",
    medications: [{ name: "Paracetamol" }],
    diagnosis: "Viral fever",
    notes: "Hydrate well",
    status: "active"
  });

  expect(invokeMock).toHaveBeenNthCalledWith(
    1,
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "upsert_prescription",
        prescriptionId: "rx-appointment-aasha",
        status: "active"
      })
    })
  );

  await approvePrescription("rx-db-1", "doctor-mehra");

  expect(invokeMock).toHaveBeenNthCalledWith(
    2,
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "approve_prescription",
        prescriptionId: "rx-db-1",
        doctorId: "doctor-mehra"
      })
    })
  );
});

test("lab reports, test orders, and notifications route through care-sync", async () => {
  invokeMock.mockResolvedValue({ data: { id: "artifact-1" }, error: null });

  await upsertLabReport({
    reportId: "lab-appointment-aasha",
    appointmentId: "appointment-aasha",
    encounterId: "enc-123",
    patientId: "patient-aasha",
    doctorId: "doctor-mehra",
    clinicId: "NIRA Pilot Clinic",
    title: "Fever workup",
    category: "Infectious disease",
    findings: "CBC and CRP ordered.",
    resultSummary: "Awaiting results.",
    status: "final"
  });

  await upsertTestOrder({
    orderId: "tests-appointment-aasha",
    appointmentId: "appointment-aasha",
    encounterId: "enc-123",
    patientId: "patient-aasha",
    doctorId: "doctor-mehra",
    clinicId: "NIRA Pilot Clinic",
    doctorName: "Dr. Nisha Mehra",
    tests: ["CBC", "CRP"],
    patientNote: "Please complete these tests today.",
    status: "ordered"
  });

  await createNotification({
    notificationId: "notification-1",
    userId: "user-patient-aasha",
    type: "tests_ordered",
    title: "Tests ordered",
    message: "CBC and CRP were ordered.",
    encounterId: "enc-123",
    appointmentId: "appointment-aasha"
  });

  expect(invokeMock).toHaveBeenNthCalledWith(
    1,
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "upsert_lab_report",
        reportId: "lab-appointment-aasha",
        status: "final"
      })
    })
  );

  expect(invokeMock).toHaveBeenNthCalledWith(
    2,
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "upsert_test_order",
        orderId: "tests-appointment-aasha",
        tests: ["CBC", "CRP"]
      })
    })
  );

  expect(invokeMock).toHaveBeenNthCalledWith(
    3,
    "care-sync",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "upsert_notification",
        notificationId: "notification-1",
        type: "tests_ordered"
      })
    })
  );
});

test("app state snapshots use care-sync actions with the configured snapshot key", async () => {
  invokeMock
    .mockResolvedValueOnce({
      data: {
        snapshotKey: "primary",
        state: { meta: { today: "2026-04-14" } },
        updatedAt: "2026-04-14T10:30:00.000Z"
      },
      error: null
    })
    .mockResolvedValueOnce({
      data: {
        snapshotKey: "primary",
        state: { meta: { today: "2026-04-15" } },
        updatedAt: "2026-04-14T10:31:00.000Z"
      },
      error: null
    });

  await expect(fetchAppStateSnapshot()).resolves.toEqual({
    meta: { today: "2026-04-14" }
  });

  await expect(persistAppStateSnapshot({ meta: { today: "2026-04-15" } })).resolves.toEqual(
    expect.objectContaining({
      synced: true,
      skipped: false,
      snapshotKey: "primary"
    })
  );

  expect(invokeMock).toHaveBeenNthCalledWith(
    1,
    "care-sync",
    expect.objectContaining({
      body: {
        action: "get_app_state_snapshot",
        snapshotKey: "primary"
      }
    })
  );

  expect(invokeMock).toHaveBeenNthCalledWith(
    2,
    "care-sync",
    expect.objectContaining({
      body: {
        action: "upsert_app_state_snapshot",
        snapshotKey: "primary",
        state: { meta: { today: "2026-04-15" } }
      }
    })
  );
});
