import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProfilePage } from "../features/shared/ProfilePage";

let demoState;
let demoActions;
let originalFileReader;
let originalNotification;

vi.mock("../app/DemoDataProvider", () => ({
  useDemoData: () => ({
    state: demoState,
    actions: demoActions
  })
}));

vi.mock("../components/layout/AppShell", () => ({
  AppShell: ({ title, children }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  )
}));

function makeCollection(items) {
  return {
    byId: Object.fromEntries(items.map((item) => [item.id, item])),
    allIds: items.map((item) => item.id)
  };
}

function makeState() {
  return {
    session: {
      userId: "user-doctor-mehra",
      role: "doctor",
      isAuthenticated: true,
      activeProfileId: "doctor-mehra",
      identifier: "nisha@nira.local"
    },
    users: makeCollection([
      {
        id: "user-doctor-mehra",
        role: "doctor",
        profileId: "doctor-mehra",
        status: "active",
        phone: "+91 95555 21001",
        email: "nisha@nira.local"
      }
    ]),
    doctors: makeCollection([
      {
        id: "doctor-mehra",
        userId: "user-doctor-mehra",
        fullName: "Dr. Nisha Mehra",
        profilePhoto: "",
        specialty: "General Medicine",
        clinic: "NIRA Pilot Clinic",
        licenseNumber: "KMC-GM-18273",
        status: "active",
        acceptingAppointments: true,
        slotDurationMinutes: 15,
        phone: "+91 95555 21001",
        email: "nisha@nira.local",
        bio: "Calm, structured consults.",
        gender: "Female"
      }
    ]),
    patients: makeCollection([]),
    nurses: makeCollection([]),
    admins: makeCollection([]),
    notifications: makeCollection([])
  };
}

beforeEach(() => {
  demoState = makeState();
  demoActions = {
    auth: {
      updateCurrentProfile: vi.fn(async (payload) => {
        demoState = {
          ...demoState,
          doctors: makeCollection([
            {
              ...demoState.doctors.byId["doctor-mehra"],
              ...payload
            }
          ])
        };

        return demoState;
      }),
      logout: vi.fn(async () => demoState)
    }
  };

  originalFileReader = globalThis.FileReader;
  originalNotification = globalThis.Notification;
  globalThis.FileReader = class MockFileReader {
    readAsDataURL() {
      this.result = "data:image/png;base64,preview-image";
      this.onload?.({ target: { result: this.result } });
    }
  };
  globalThis.Notification = {
    requestPermission: vi.fn(async () => "granted")
  };
});

afterEach(() => {
  demoState = undefined;
  demoActions = undefined;
  globalThis.FileReader = originalFileReader;
  globalThis.Notification = originalNotification;
});

test("profile page starts in view mode and only unlocks fields after edit", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

  const fullNameInput = screen.getByLabelText(/full name/i);

  expect(fullNameInput).toBeDisabled();
  expect(screen.queryByRole("button", { name: /save profile/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^edit$/i }));

  expect(fullNameInput).toBeEnabled();
  expect(screen.getByRole("button", { name: /save profile/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
});

test("profile page previews and saves an uploaded profile picture", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: /^edit$/i }));

  const photoInput = screen.getByLabelText(/profile picture upload/i);
  const file = new File(["avatar"], "doctor.png", { type: "image/png" });

  fireEvent.change(photoInput, { target: { files: [file] } });

  expect(screen.getByAltText(/dr\. nisha mehra profile/i)).toHaveAttribute(
    "src",
    "data:image/png;base64,preview-image"
  );

  await user.click(screen.getByRole("button", { name: /save profile/i }));

  await waitFor(() => {
    expect(demoActions.auth.updateCurrentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profilePhoto: "data:image/png;base64,preview-image"
      })
    );
  });
});

test("profile quick actions are interactive", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: /push notifications/i }));
  expect(globalThis.Notification.requestPermission).toHaveBeenCalled();
  expect(screen.getByText(/push notifications are enabled/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^logout$/i }));
  expect(demoActions.auth.logout).toHaveBeenCalled();
});
