import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("patient login and slot booking keep pre-check in chat flow", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/patient");

  await screen.findByRole("heading", { name: /patient login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "+91 98765 43210");
  await user.type(screen.getByLabelText(/password/i), "Patient@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByRole("button", { name: /logout/i })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: /^booking$/i }));

  expect(await screen.findByText("Book by live doctor slots")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /dr\. nisha mehra/i }));
  const slotButtons = screen
    .getAllByRole("button")
    .filter((button) => /\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/i.test(button.textContent || ""));
  const firstAvailableSlot = slotButtons.find((button) => !button.disabled);
  expect(firstAvailableSlot).toBeTruthy();
  await user.click(firstAvailableSlot);
  await user.click(screen.getByRole("button", { name: /confirm slot/i }));

  expect(await screen.findByText("Appointment created")).toBeInTheDocument();

  const bookingState = JSON.parse(window.localStorage.getItem("nira-demo-state-v2"));
  const questionnaires = Object.values(bookingState.precheckQuestionnaires?.byId || {});
  const notifications = Object.values(bookingState.notifications?.byId || {});
  expect(questionnaires.some((item) => item.appointmentId)).toBe(true);
  expect(notifications.some((item) => item.type === "precheck_sent")).toBe(true);

  await user.click(screen.getByRole("link", { name: /open appointment/i }));
  expect(await screen.findByText(/what happens now/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /open pre-check form/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /open pre-check in chat/i })).not.toBeInTheDocument();
});
