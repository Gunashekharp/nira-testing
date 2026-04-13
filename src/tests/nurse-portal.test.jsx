import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("loads the nurse portal with the core workflow screens", async () => {
  const user = userEvent.setup();

  renderApp("/auth/login/nurse");

  expect((await screen.findAllByRole("heading", { name: "Nurse login" })).length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: /use demo credentials/i }));
  await user.click(screen.getByRole("button", { name: /^login$/i }));

  expect(await screen.findByText("Nurse command center")).toBeInTheDocument();
  expect(screen.getByText("Today's ward picture")).toBeInTheDocument();
  expect(screen.getByText("Scan, capture, and save in under 30 seconds")).toBeInTheDocument();
  expect(screen.getByText("Barcode + 5-rights confirmation")).toBeInTheDocument();
  expect(screen.getByText("My patients, ward view, and critical filter")).toBeInTheDocument();
  expect(screen.getByText("Checklist with timestamps and escalation")).toBeInTheDocument();
  expect(screen.getByText("Critical first, then medium, then routine")).toBeInTheDocument();
  expect(screen.getByText("Flowsheets, notes, photos, and templates")).toBeInTheDocument();
  expect(screen.getByText("Orders, SBAR, team chat, and call light")).toBeInTheDocument();
});