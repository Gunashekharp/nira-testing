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
});
