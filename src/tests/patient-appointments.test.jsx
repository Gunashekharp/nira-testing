import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { PatientAppointmentDetailPanel } from "../features/patient/PatientAppointmentDetailPanel";
import { renderApp } from "./testUtils";
import { createSeedState } from "../data/seed";
import { addDays, toIsoDateTime } from "../lib/schedule";
import { STORAGE_KEY } from "../services/demoStore";

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.removeItem(STORAGE_KEY);
});

async function loginPatient(user) {
  await screen.findByRole("heading", { name: /patient login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "+91 98765 43210");
  await user.type(screen.getByLabelText(/password/i), "Patient@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));
  await screen.findByRole("button", { name: /logout/i });
}

test("patient dashboard buckets open appointment lists and review detail states", async () => {
  const seedState = createSeedState();
  const tomorrow = addDays(seedState.meta.today, 1);
  seedState.appointments.byId["appointment-aasha"] = {
    ...seedState.appointments.byId["appointment-aasha"],
    startAt: toIsoDateTime(tomorrow, "09:15"),
    endAt: toIsoDateTime(tomorrow, "09:30")
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

  const user = userEvent.setup();
  renderApp("/auth/login/patient");

  await loginPatient(user);
  await user.click(screen.getByRole("link", { name: /in review/i }));

  expect(await screen.findByRole("heading", { name: /my appointments/i, level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /pre-check submitted/i })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: /dr\. nisha mehra/i }));

  expect(await screen.findByText("What happens now")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /view pre-check summary/i })).not.toBeInTheDocument();
  expect(screen.getAllByText(/pre-check/i).length).toBeGreaterThan(0);
});

test("patient can cancel a non-completed appointment and the slot becomes bookable again", async () => {
  const seedState = createSeedState();
  const tomorrow = addDays(seedState.meta.today, 1);
  seedState.appointments.byId["appointment-aasha"] = {
    ...seedState.appointments.byId["appointment-aasha"],
    slotId: `slot-doctor-mehra-${tomorrow}-09:15`,
    startAt: toIsoDateTime(tomorrow, "09:15"),
    endAt: toIsoDateTime(tomorrow, "09:30")
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));

  const user = userEvent.setup();
  renderApp("/auth/login/patient");

  await loginPatient(user);
  await user.click(screen.getByRole("link", { name: /in review/i }));
  await user.click(screen.getByRole("link", { name: /dr\. nisha mehra/i }));

  await user.click(screen.getByRole("button", { name: /cancel appointment/i }));
  await user.click(screen.getByRole("button", { name: /yes, cancel this appointment/i }));

  expect(await screen.findByText("Appointment cancelled")).toBeInTheDocument();
  const rebookLink = screen
    .getAllByRole("link", { name: /book another appointment/i })
    .find((element) => element.getAttribute("href") === "/patient/booking");
  await user.click(rebookLink);

  expect(await screen.findByText("Book by live doctor slots")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /dr\. nisha mehra/i }));
  const slotButtons = screen
    .getAllByRole("button")
    .filter((button) => /\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/i.test(button.textContent || ""));
  const firstAvailableSlot = slotButtons.find((button) => !button.disabled);
  expect(firstAvailableSlot).toBeTruthy();
  expect(firstAvailableSlot).not.toBeDisabled();
});

test("appointment detail panel does not crash when no appointment is selected", () => {
  render(
    <MemoryRouter>
      <PatientAppointmentDetailPanel appointment={null} />
    </MemoryRouter>
  );

  expect(screen.getByText("Select an appointment")).toBeInTheDocument();
});
