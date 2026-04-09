import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

async function loginAdmin(user) {
  await screen.findByRole("heading", { name: /admin login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "admin@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Admin@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));
  await screen.findByRole("heading", { name: /admin console/i, level: 1 });
}

test("admin can add, archive, and restore a patient without deleting history", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/admin");

  await loginAdmin(user);
  await user.click(screen.getAllByRole("link", { name: /patients/i })[0]);

  expect(await screen.findByRole("heading", { name: /patient management/i, level: 1 })).toBeInTheDocument();

  await user.type(screen.getAllByLabelText(/full name/i)[0], "Kiran Shah");
  await user.type(screen.getAllByLabelText(/^phone$/i)[0], "+91 90011 22334");
  await user.type(screen.getAllByLabelText(/^email$/i)[0], "kiran.shah@nira.local");
  await user.click(screen.getByRole("button", { name: /add patient/i }));

  const patientRow = await screen.findByRole("button", { name: /kiran shah/i });
  expect(patientRow).toBeInTheDocument();

  await user.click(patientRow);
  await user.click(screen.getByRole("button", { name: /archive patient/i }));

  expect(await screen.findByRole("button", { name: /restore patient/i })).toBeInTheDocument();
  expect(screen.getByText("archived")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /restore patient/i }));
  expect(await screen.findByRole("button", { name: /archive patient/i })).toBeInTheDocument();
});
