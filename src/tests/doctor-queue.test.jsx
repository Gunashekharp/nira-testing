import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("doctor queue control shows a table layout and hides pending symptom placeholders", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/doctor");

  await screen.findByRole("heading", { name: /doctor login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "nisha.mehra@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Doctor@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Doctor validation workspace")).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /dr\. nisha mehra · internal medicine/i, level: 2 })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /patient/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /chief complaint/i })).toBeInTheDocument();
  expect(screen.queryByText(/pending symptom interview/i)).not.toBeInTheDocument();
});