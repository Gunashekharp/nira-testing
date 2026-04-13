import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("auth gateway supports first admin demo reset", async () => {
  const user = userEvent.setup();
  renderApp("/auth");

  expect(await screen.findByText("Role-based clinic access")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hospital access" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();

  await user.click(screen.getByRole("link", { name: /hospital access/i }));
  await screen.findByRole("heading", { name: /hospital access/i, level: 1 });
  await user.click(screen.getByRole("button", { name: /first admin setup/i }));

  expect(await screen.findByRole("link", { name: /first admin signup/i })).toBeInTheDocument();
});
