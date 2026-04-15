import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { PatientHomePage } from "../features/patient/PatientHomePage";

let demoState;

vi.mock("../app/DemoDataProvider", () => ({
  useDemoData: () => ({ state: demoState })
}));

vi.mock("../hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key) => key })
}));

vi.mock("../components/layout/AppShell", () => ({
  AppShell: ({ children }) => <div>{children}</div>
}));

function makeCollection(items) {
  return {
    byId: Object.fromEntries(items.map((item) => [item.id, item])),
    allIds: items.map((item) => item.id)
  };
}

function makeState() {
  return {
    meta: {
      today: "2026-04-10"
    },
    session: {
      userId: "user-patient-aasha",
      role: "patient",
      isAuthenticated: true,
      activeProfileId: "patient-aasha",
      identifier: "+91 98765 43210"
    },
    users: makeCollection([
      {
        id: "user-patient-aasha",
        role: "patient",
        profileId: "patient-aasha",
        status: "active",
        phone: "+91 98765 43210",
        email: "aasha@nira.local"
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
    encounters: makeCollection([]),
    prescriptions: makeCollection([]),
    labReports: makeCollection([]),
    precheckQuestionnaires: makeCollection([]),
    notifications: makeCollection([])
  };
}

afterEach(() => {
  vi.useRealTimers();
  demoState = undefined;
});

test("patient home calendar highlights use the clinic day", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-09T19:00:00.000Z"));
  demoState = makeState();

  render(
    <MemoryRouter>
      <PatientHomePage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: /calendar highlights/i, level: 3 })).toBeInTheDocument();
  expect(screen.getByText("1 today")).toBeInTheDocument();
  expect(screen.getAllByText(/dr\. nisha mehra/i).length).toBeGreaterThan(0);
  expect(screen.queryByText(/no appointments today/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /need help\?/i })).not.toBeInTheDocument();
});

test("patient home shows pre-check launch card for a pending questionnaire", () => {
  demoState = makeState();
  demoState.precheckQuestionnaires = makeCollection([
    {
      id: "precheck-appointment-aasha",
      appointmentId: "appointment-aasha",
      encounterId: "encounter-appointment-aasha",
      patientId: "patient-aasha",
      doctorId: "doctor-mehra",
      status: "sent_to_patient",
      aiQuestions: [],
      editedQuestions: [],
      patientResponses: {},
      patientCompletedAt: null,
      doctorConfirmedAt: "2026-04-09T10:00:00.000Z",
      sentToPatientAt: "2026-04-09T10:00:00.000Z",
      createdAt: "2026-04-09T09:59:00.000Z",
      updatedAt: "2026-04-09T10:00:00.000Z",
      precheckSummary: null
    }
  ]);

  render(
    <MemoryRouter>
      <PatientHomePage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: /prepare each visit separately/i, level: 3 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /start pre-check for dr\. nisha mehra/i })).toBeInTheDocument();
  expect(screen.getByText(/your doctor has sent pre-check questions for this appointment/i)).toBeInTheDocument();
});

test("patient home shows separate pre-check cards for different appointments and problems", () => {
  demoState = makeState();
  demoState.doctors = makeCollection([
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
    },
    {
      id: "doctor-shah",
      userId: "user-doctor-shah",
      fullName: "Dr. Rehan Shah",
      specialty: "Neurology",
      clinic: "NIRA Pilot Clinic",
      licenseNumber: "KMC-NE-77124",
      status: "active",
      acceptingAppointments: true,
      slotDurationMinutes: 15,
      phone: "+91 95555 21002",
      email: "rehan@nira.local",
      bio: ""
    },
  ]);
  demoState.appointments = makeCollection([
    ...Object.values(demoState.appointments.byId),
    {
      id: "appointment-aasha-neuro",
      patientId: "patient-aasha",
      doctorId: "doctor-shah",
      bookedByUserId: "user-patient-aasha",
      visitType: "booked",
      bookingStatus: "scheduled",
      token: "B07",
      slotId: "slot-doctor-shah-2026-04-11-11:00",
      startAt: "2026-04-11T11:00:00+05:30",
      endAt: "2026-04-11T11:15:00+05:30"
    },
  ]);
  demoState.precheckQuestionnaires = makeCollection([
    {
      id: "precheck-appointment-aasha",
      appointmentId: "appointment-aasha",
      encounterId: "encounter-appointment-aasha",
      patientId: "patient-aasha",
      doctorId: "doctor-mehra",
      status: "sent_to_patient",
      aiQuestions: [],
      editedQuestions: [],
      patientResponses: {},
      metadata: {
        chiefComplaint: "Constipation for 3 days"
      },
      patientCompletedAt: null,
      doctorConfirmedAt: "2026-04-09T10:00:00.000Z",
      sentToPatientAt: "2026-04-09T10:00:00.000Z",
      createdAt: "2026-04-09T09:59:00.000Z",
      updatedAt: "2026-04-09T10:00:00.000Z",
      precheckSummary: null
    },
    {
      id: "precheck-appointment-aasha-neuro",
      appointmentId: "appointment-aasha-neuro",
      encounterId: "encounter-appointment-aasha-neuro",
      patientId: "patient-aasha",
      doctorId: "doctor-shah",
      status: "sent_to_patient",
      aiQuestions: [],
      editedQuestions: [],
      patientResponses: {},
      metadata: {
        chiefComplaint: "Migraine with light sensitivity"
      },
      patientCompletedAt: null,
      doctorConfirmedAt: "2026-04-09T11:00:00.000Z",
      sentToPatientAt: "2026-04-09T11:00:00.000Z",
      createdAt: "2026-04-09T10:59:00.000Z",
      updatedAt: "2026-04-09T11:00:00.000Z",
      precheckSummary: null
    },
  ]);

  render(
    <MemoryRouter>
      <PatientHomePage />
    </MemoryRouter>
  );

  expect(screen.getByRole("button", { name: /dr\. nisha mehra about constipation for 3 days/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /dr\. rehan shah about migraine with light sensitivity/i })).toBeInTheDocument();
  expect(screen.getByText(/your doctors have sent pre-check questions for 2 appointments/i)).toBeInTheDocument();
  expect(screen.getByText(/constipation for 3 days/i)).toBeInTheDocument();
  expect(screen.getByText(/migraine with light sensitivity/i)).toBeInTheDocument();
});

test("patient home removes a completed pre-check while keeping other pending ones visible", () => {
  demoState = makeState();
  demoState.doctors = makeCollection([
    ...Object.values(demoState.doctors.byId),
    {
      id: "doctor-shah",
      userId: "user-doctor-shah",
      fullName: "Dr. Rehan Shah",
      specialty: "Neurology",
      clinic: "NIRA Pilot Clinic",
      licenseNumber: "KMC-NE-77124",
      status: "active",
      acceptingAppointments: true,
      slotDurationMinutes: 15,
      phone: "+91 95555 21002",
      email: "rehan@nira.local",
      bio: ""
    },
  ]);
  demoState.appointments = makeCollection([
    ...Object.values(demoState.appointments.byId),
    {
      id: "appointment-aasha-neuro",
      patientId: "patient-aasha",
      doctorId: "doctor-shah",
      bookedByUserId: "user-patient-aasha",
      visitType: "booked",
      bookingStatus: "scheduled",
      token: "B07",
      slotId: "slot-doctor-shah-2026-04-11-11:00",
      startAt: "2026-04-11T11:00:00+05:30",
      endAt: "2026-04-11T11:15:00+05:30"
    },
  ]);
  demoState.precheckQuestionnaires = makeCollection([
    {
      id: "precheck-appointment-aasha",
      appointmentId: "appointment-aasha",
      encounterId: "encounter-appointment-aasha",
      patientId: "patient-aasha",
      doctorId: "doctor-mehra",
      status: "completed",
      aiQuestions: [],
      editedQuestions: [],
      patientResponses: {
        "precheck-1": "Fever"
      },
      metadata: {
        chiefComplaint: "Fever"
      },
      patientCompletedAt: "2026-04-09T10:05:00.000Z",
      doctorConfirmedAt: "2026-04-09T10:00:00.000Z",
      sentToPatientAt: "2026-04-09T10:00:00.000Z",
      createdAt: "2026-04-09T09:59:00.000Z",
      updatedAt: "2026-04-09T10:05:00.000Z",
      precheckSummary: {
        "What brings you in?": "Fever"
      }
    },
    {
      id: "precheck-appointment-aasha-neuro",
      appointmentId: "appointment-aasha-neuro",
      encounterId: "encounter-appointment-aasha-neuro",
      patientId: "patient-aasha",
      doctorId: "doctor-shah",
      status: "sent_to_patient",
      aiQuestions: [],
      editedQuestions: [],
      patientResponses: {},
      metadata: {
        chiefComplaint: "Migraine with nausea"
      },
      patientCompletedAt: null,
      doctorConfirmedAt: "2026-04-09T11:00:00.000Z",
      sentToPatientAt: "2026-04-09T11:00:00.000Z",
      createdAt: "2026-04-09T10:59:00.000Z",
      updatedAt: "2026-04-09T11:00:00.000Z",
      precheckSummary: null
    },
  ]);

  render(
    <MemoryRouter>
      <PatientHomePage />
    </MemoryRouter>
  );

  expect(screen.queryByRole("button", { name: /dr\. nisha mehra/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /dr\. rehan shah about migraine with nausea/i })).toBeInTheDocument();
  expect(screen.queryByText(/^Fever$/)).not.toBeInTheDocument();
  expect(screen.getByText(/migraine with nausea/i)).toBeInTheDocument();
});
