import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("redirects guests to auth and supports first admin demo reset", async () => {
  const user = userEvent.setup();
  renderApp("/patient");

  expect(await screen.findByText("Role-based clinic access")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Sign up" })).toHaveLength(2);

  await user.click(screen.getByRole("button", { name: /first admin setup/i }));

  expect(await screen.findAllByRole("link", { name: "Sign up" })).toHaveLength(3);
});
