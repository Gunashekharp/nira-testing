import { afterEach, expect, test, vi } from "vitest";
import { getPatientWorkspace } from "../features/shared/selectors";

function makeCollection(items) {
  return {
    byId: Object.fromEntries(items.map((item) => [item.id, item])),
    allIds: items.map((item) => item.id)
  };
}

afterEach(() => {
  vi.useRealTimers();
});

test("expired scheduled appointments move into the missed bucket", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-10T06:30:00.000Z"));

  const state = {
    meta: {
      today: "2026-04-10"
    },
    session: {
      userId: "user-patient-aasha",
      role: "patient",
      isAuthenticated: true,
      activeProfileId: "patient-aasha",
      identifier: "aasha@nira.local"
    },
    users: makeCollection([
      {
        id: "user-patient-aasha",
        role: "patient",
        profileId: "patient-aasha",
        status: "active",
        phone: "+91 98765 43210",
        email: "aasha@nira.local"
      },
      {
        id: "user-doctor-mehra",
        role: "doctor",
        profileId: "doctor-mehra",
        status: "active",
        phone: "+91 95555 21001",
        email: "nisha@nira.local"
      }
    ]),
    patients: makeCollection([
      {
        id: "patient-aasha",
        userId: "user-patient-aasha",
        fullName: "Aasha Verma",
        preferredLanguage: "en",
        age: 34,
        gender: "female",
        city: "Pune",
        phone: "+91 98765 43210",
        email: "aasha@nira.local",
        abhaNumber: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        notes: ""
      }
    ]),
    doctors: makeCollection([
      {
        id: "doctor-mehra",
        userId: "user-doctor-mehra",
        fullName: "Dr. Nisha Mehra",
        specialty: "General Medicine",
        clinic: "NIRA Pilot Clinic",
        licenseNumber: "KMC-GM-18273",
        status: "active",
        acceptingAppointments: true,
        slotDurationMinutes: 15,
        phone: "+91 95555 21001",
        email: "nisha@nira.local",
        bio: ""
      }
    ]),
    appointments: makeCollection([
      {
        id: "appointment-aasha",
        patientId: "patient-aasha",
        doctorId: "doctor-mehra",
        bookedByUserId: "user-patient-aasha",
        visitType: "booked",
        bookingStatus: "scheduled",
        token: "A12",
        slotId: "slot-doctor-mehra-2026-04-10-09:15",
        startAt: "2026-04-10T09:15:00+05:30",
        endAt: "2026-04-10T09:30:00+05:30"
      }
    ]),
    interviews: makeCollection([]),
    encounters: makeCollection([
      {
        id: "encounter-appointment-aasha",
        appointmentId: "appointment-aasha",
        doctorId: "doctor-mehra",
        patientId: "patient-aasha",
        interviewId: "interview-appointment-aasha",
        status: "awaiting_interview",
        prescriptionId: null
      }
    ]),
    prescriptions: makeCollection([]),
    labReports: makeCollection([]),
    testOrders: makeCollection([]),
    precheckQuestionnaires: makeCollection([]),
    notifications: makeCollection([])
  };

  const workspace = getPatientWorkspace(state);

  expect(workspace.bucketCounts.missed).toBe(1);
  expect(workspace.bucketCounts.upcoming).toBe(0);
  expect(workspace.appointmentsByBucket.missed[0]?.journeyLabel).toBe("Missed appointment");
  expect(workspace.nextRecommendedAction.label).toBe("Reschedule appointment");
});

test("expired scheduled appointments with in-review data still move to missed", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-10T06:30:00.000Z"));

  const state = {
    meta: {
      today: "2026-04-10"
    },
    session: {
      userId: "user-patient-aasha",
      role: "patient",
      isAuthenticated: true,
      activeProfileId: "patient-aasha",
      identifier: "aasha@nira.local"
    },
    users: makeCollection([
      {
        id: "user-patient-aasha",
        role: "patient",
        profileId: "patient-aasha",
        status: "active",
        phone: "+91 98765 43210",
        email: "aasha@nira.local"
      },
      {
        id: "user-doctor-mehra",
        role: "doctor",
        profileId: "doctor-mehra",
        status: "active",
        phone: "+91 95555 21001",
        email: "nisha@nira.local"
      }
    ]),
    patients: makeCollection([
      {
        id: "patient-aasha",
        userId: "user-patient-aasha",
        fullName: "Aasha Verma",
        preferredLanguage: "en",
        age: 34,
        gender: "female",
        city: "Pune",
        phone: "+91 98765 43210",
        email: "aasha@nira.local",
        abhaNumber: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        notes: ""
      }
    ]),
    doctors: makeCollection([
      {
        id: "doctor-mehra",
        userId: "user-doctor-mehra",
        fullName: "Dr. Nisha Mehra",
        specialty: "General Medicine",
        clinic: "NIRA Pilot Clinic",
        licenseNumber: "KMC-GM-18273",
        status: "active",
        acceptingAppointments: true,
        slotDurationMinutes: 15,
        phone: "+91 95555 21001",
        email: "nisha@nira.local",
        bio: ""
      }
    ]),
    appointments: makeCollection([
      {
        id: "appointment-aasha",
        patientId: "patient-aasha",
        doctorId: "doctor-mehra",
        bookedByUserId: "user-patient-aasha",
        visitType: "booked",
        bookingStatus: "scheduled",
        token: "A12",
        slotId: "slot-doctor-mehra-2026-04-10-09:15",
        startAt: "2026-04-10T09:15:00+05:30"
      }
    ]),
    interviews: makeCollection([]),
    encounters: makeCollection([
      {
        id: "encounter-appointment-aasha",
        appointmentId: "appointment-aasha",
        doctorId: "doctor-mehra",
        patientId: "patient-aasha",
        interviewId: "interview-appointment-aasha",
        status: "ai_ready",
        prescriptionId: null
      }
    ]),
    prescriptions: makeCollection([]),
    labReports: makeCollection([]),
    testOrders: makeCollection([]),
    precheckQuestionnaires: makeCollection([]),
    notifications: makeCollection([])
  };

  const workspace = getPatientWorkspace(state);

  expect(workspace.bucketCounts.missed).toBe(1);
  expect(workspace.bucketCounts.review).toBe(0);
  expect(workspace.bucketCounts.upcoming).toBe(0);
  expect(workspace.appointmentsByBucket.missed[0]?.journeyLabel).toBe("Missed appointment");
});

test("expired checked-in appointments in doctor review still move to missed", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-10T06:30:00.000Z"));

  const state = {
    meta: {
      today: "2026-04-10"
    },
    session: {
      userId: "user-patient-aasha",
      role: "patient",
      isAuthenticated: true,
      activeProfileId: "patient-aasha",
      identifier: "aasha@nira.local"
    },
    users: makeCollection([
      {
        id: "user-patient-aasha",
        role: "patient",
        profileId: "patient-aasha",
        status: "active",
        phone: "+91 98765 43210",
        email: "aasha@nira.local"
      },
      {
        id: "user-doctor-mehra",
        role: "doctor",
        profileId: "doctor-mehra",
        status: "active",
        phone: "+91 95555 21001",
        email: "nisha@nira.local"
      }
    ]),
    patients: makeCollection([
      {
        id: "patient-aasha",
        userId: "user-patient-aasha",
        fullName: "Aasha Verma",
        preferredLanguage: "en",
        age: 34,
        gender: "female",
        city: "Pune",
        phone: "+91 98765 43210",
        email: "aasha@nira.local",
        abhaNumber: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        notes: ""
      }
    ]),
    doctors: makeCollection([
      {
        id: "doctor-mehra",
        userId: "user-doctor-mehra",
        fullName: "Dr. Nisha Mehra",
        specialty: "General Medicine",
        clinic: "NIRA Pilot Clinic",
        licenseNumber: "KMC-GM-18273",
        status: "active",
        acceptingAppointments: true,
        slotDurationMinutes: 15,
        phone: "+91 95555 21001",
        email: "nisha@nira.local",
        bio: ""
      }
    ]),
    appointments: makeCollection([
      {
        id: "appointment-aasha",
        patientId: "patient-aasha",
        doctorId: "doctor-mehra",
        bookedByUserId: "user-patient-aasha",
        visitType: "booked",
        bookingStatus: "checked_in",
        token: "A12",
        slotId: "slot-doctor-mehra-2026-04-10-09:15",
        startAt: "2026-04-10T09:15:00+05:30",
        endAt: "2026-04-10T09:30:00+05:30"
      }
    ]),
    interviews: makeCollection([]),
    encounters: makeCollection([
      {
        id: "encounter-appointment-aasha",
        appointmentId: "appointment-aasha",
        doctorId: "doctor-mehra",
        patientId: "patient-aasha",
        interviewId: "interview-appointment-aasha",
        status: "ai_ready",
        prescriptionId: null
      }
    ]),
    prescriptions: makeCollection([]),
    labReports: makeCollection([]),
    testOrders: makeCollection([]),
    precheckQuestionnaires: makeCollection([]),
    notifications: makeCollection([])
  };

  const workspace = getPatientWorkspace(state);

  expect(workspace.bucketCounts.missed).toBe(1);
  expect(workspace.bucketCounts.review).toBe(0);
  expect(workspace.bucketCounts.upcoming).toBe(0);
  expect(workspace.appointmentsByBucket.missed[0]?.journeyLabel).toBe("Missed appointment");
});
