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
  expect(screen.getByText("Patients booked from portal")).toBeInTheDocument();
  expect(screen.getByText("Enter and save to EMR")).toBeInTheDocument();
  expect(screen.getByText("How this nurse screen now works")).toBeInTheDocument();
  expect(screen.getByText("Filter by status")).toBeInTheDocument();
  expect(screen.getByText("All dates")).toBeInTheDocument();
  expect(screen.getByText("Today")).toBeInTheDocument();
  expect(screen.getByLabelText("Calendar day")).toBeInTheDocument();
  expect(screen.getByText(/Virtualized list enabled/i)).toBeInTheDocument();
  expect(screen.queryByText("Today's ward picture")).not.toBeInTheDocument();
  expect(screen.queryByText("My patients, ward view, and critical filter")).not.toBeInTheDocument();
});