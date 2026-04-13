import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

function getLinkByHref(path) {
  const link = screen.getAllByRole("link").find((entry) => entry.getAttribute("href") === path);
  if (!link) {
    throw new Error(`Expected link not found for ${path}`);
  }
  return link;
}

test("admin can add another admin and the new admin can login", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/admin");

  await screen.findByRole("heading", { name: /admin login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "admin@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Admin@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Admin console")).toBeInTheDocument();
  await user.click(screen.getAllByRole("link", { name: /admins/i })[0]);

  expect(await screen.findByText("Admin management")).toBeInTheDocument();
  await user.type(screen.getByLabelText(/full name/i), "Priya Singh");
  await user.type(screen.getByLabelText(/^phone$/i), "+91 90000 11111");
  await user.type(screen.getByLabelText(/^email$/i), "priya.singh@nira.local");

  const passwordInputs = screen.getAllByLabelText(/password/i);
  await user.clear(passwordInputs[0]);
  await user.type(passwordInputs[0], "Admin@123");

  await user.click(screen.getByRole("button", { name: /add admin/i }));

  expect(await screen.findByText("Priya Singh")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /logout/i }));

  await screen.findByRole("link", { name: /hospital access/i });
  await user.click(screen.getByRole("link", { name: /hospital access/i }));
  await screen.findByRole("heading", { name: /hospital access/i, level: 1 });
  await user.click(getLinkByHref("/auth/login/admin"));

  await screen.findByRole("heading", { name: /admin login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "priya.singh@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Admin@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Admin console")).toBeInTheDocument();
}, 15000);

test("admin can add a doctor and the doctor can login", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/admin");

  await screen.findByRole("heading", { name: /admin login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "admin@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Admin@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Admin console")).toBeInTheDocument();
  await user.click(screen.getAllByRole("link", { name: /doctors/i })[0]);

  expect(await screen.findByText("Doctor management")).toBeInTheDocument();

  await user.type(screen.getAllByLabelText(/full name/i)[0], "Dr Test Kumar");
  await user.type(screen.getAllByLabelText(/^phone$/i)[0], "+91 90000 22222");
  await user.type(screen.getAllByLabelText(/^email$/i)[0], "test.kumar@nira.local");

  const passwordInputs = screen.getAllByLabelText(/password/i);
  await user.clear(passwordInputs[0]);
  await user.type(passwordInputs[0], "Doctor@123");

  await user.type(screen.getAllByLabelText(/specialty/i)[0], "General Medicine");
  await user.type(screen.getAllByLabelText(/license number/i)[0], "NMC-TEST-123");
  await user.click(screen.getByRole("button", { name: /add doctor/i }));

  expect(await screen.findByText("Dr Test Kumar")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /logout/i }));

  await screen.findByRole("link", { name: /hospital access/i });
  await user.click(screen.getByRole("link", { name: /hospital access/i }));
  await screen.findByRole("heading", { name: /hospital access/i, level: 1 });
  await user.click(getLinkByHref("/auth/login/doctor"));

  await screen.findByRole("heading", { name: /doctor login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "test.kumar@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Doctor@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Doctor validation workspace")).toBeInTheDocument();
}, 15000);
