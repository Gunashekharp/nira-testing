import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

async function loginLab(user) {
  await screen.findByRole("heading", { name: /lab technician login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "lab@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Lab@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));
  await screen.findByRole("heading", { name: /lab operations dashboard/i, level: 1 });
}

async function loginPatient(user, identifier) {
  await screen.findByRole("heading", { name: /patient login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), identifier);
  await user.type(screen.getByLabelText(/password/i), "Patient@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));
  await screen.findByRole("button", { name: /logout/i });
}

test("lab technician can complete a requested lab order and the patient can then see it in the portal", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/lab");

  await loginLab(user);
  await user.click(screen.getByRole("link", { name: /pranav sen/i }));

  expect(await screen.findByRole("heading", { name: /lab order detail/i, level: 1 })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /mark sample received/i }));
  await user.click(await screen.findByRole("button", { name: /start processing/i }));
  await user.click(await screen.findByRole("button", { name: /complete and publish report/i }));

  expect(await screen.findByText(/published report/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /download report/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /logout/i }));
  await screen.findByText(/role-based clinic access/i);
  await user.click(screen.getAllByRole("link", { name: /^login$/i })[0]);

  await loginPatient(user, "+91 98444 21009");
  const labReportsLink = screen
    .getAllByRole("link", { name: /lab reports/i })
    .find((element) => element.getAttribute("href") === "/patient/lab-reports");
  expect(labReportsLink).toBeDefined();
  await user.click(labReportsLink);

  expect(await screen.findByRole("heading", { name: /my lab reports/i, level: 1 })).toBeInTheDocument();
  expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: /dr\. nisha mehra/i })).toBeInTheDocument();
});
