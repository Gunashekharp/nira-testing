import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("admin can approve a pending doctor and the doctor can then access the dashboard", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/admin");

  await screen.findByRole("heading", { name: /admin login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "admin@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Admin@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Admin console")).toBeInTheDocument();
  await user.click(screen.getAllByRole("link", { name: /doctors/i })[0]);

  expect(await screen.findByText("Doctor management")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: /approve/i })[0]);
  await user.click(screen.getByRole("button", { name: /logout/i }));

  await screen.findByText("Role-based clinic access");
  await user.click(screen.getAllByRole("link", { name: /^login$/i })[1]);

  await screen.findByRole("heading", { name: /doctor login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "farah.ali@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Doctor@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Doctor validation workspace")).toBeInTheDocument();
});
