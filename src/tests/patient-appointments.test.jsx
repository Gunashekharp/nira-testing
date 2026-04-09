import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

async function loginPatient(user) {
  await screen.findByRole("heading", { name: /patient login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "+91 98765 43210");
  await user.type(screen.getByLabelText(/password/i), "Patient@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));
  await screen.findByRole("button", { name: /logout/i });
}

test("patient dashboard buckets open appointment lists and review detail states", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/patient");

  await loginPatient(user);
  await user.click(screen.getByRole("link", { name: /in review/i }));

  expect(await screen.findByRole("heading", { name: /my appointments/i, level: 1 })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: /dr\. nisha mehra/i }));

  expect(await screen.findByText("What happens now")).toBeInTheDocument();
  const interviewSummaryLink = screen
    .getAllByRole("link", { name: /view interview summary/i })
    .find((element) => element.getAttribute("href") === "#interview-summary");
  expect(interviewSummaryLink).toBeInTheDocument();
  expect(screen.getAllByText(/submitted to doctor/i).length).toBeGreaterThan(0);
});

test("patient can cancel a non-completed appointment and the slot becomes bookable again", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/patient");

  await loginPatient(user);
  await user.click(screen.getByRole("link", { name: /in review/i }));
  await user.click(screen.getByRole("link", { name: /dr\. nisha mehra/i }));

  await user.click(await screen.findByRole("button", { name: /cancel appointment/i }));
  await user.click(screen.getByRole("button", { name: /yes, cancel this appointment/i }));

  expect(await screen.findByText("Appointment cancelled")).toBeInTheDocument();
  const rebookLink = screen
    .getAllByRole("link", { name: /book another appointment/i })
    .find((element) => element.getAttribute("href") === "/patient/booking");
  await user.click(rebookLink);

  expect(await screen.findByText("Book by live doctor slots")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /9:15.*9:30/i })).not.toBeDisabled();
});
