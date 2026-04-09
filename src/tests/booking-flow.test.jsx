import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("patient login, slot booking, and interview handoff work", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/patient");

  await screen.findByRole("heading", { name: /patient login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "+91 98765 43210");
  await user.type(screen.getByLabelText(/password/i), "Patient@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByRole("button", { name: /logout/i })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: /^booking$/i }));

  expect(await screen.findByText("Book by live doctor slots")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /confirm slot/i }));

  expect(await screen.findByText("Appointment created")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /start ai interview/i }));

  expect(await screen.findByText("Doctor handoff preview")).toBeInTheDocument();
});
