import { screen } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("doctor can log in, review a chart, and approve a prescription", async () => {
  const user = userEvent.setup();
  renderApp("/auth/login/doctor");

  await screen.findByRole("heading", { name: /doctor login/i, level: 1 });
  await user.type(screen.getByLabelText(/phone or email/i), "nisha.mehra@nira.local");
  await user.type(screen.getByLabelText(/password/i), "Doctor@123");
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Doctor validation workspace")).toBeInTheDocument();
  const aashaRow = await screen.findByRole("row", { name: /aasha verma/i });
  await user.click(within(aashaRow).getByRole("link", { name: /open/i }));

  expect(await screen.findByText("Unified EMR")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /approve and publish rx/i }));

  expect(await screen.findByText("Prescription issued")).toBeInTheDocument();
  expect(await screen.findByText(/Approved for Aasha Verma/i)).toBeInTheDocument();
});
