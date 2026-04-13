import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

test("auth gateway shows patient and hospital entry points", async () => {
  const user = userEvent.setup();
  renderApp("/auth");

  expect(await screen.findByText("Role-based clinic access")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /hospital access/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /patient login/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /patient signup/i })).toBeInTheDocument();

  await user.click(screen.getByRole("link", { name: /hospital access/i }));

  expect(await screen.findByRole("heading", { name: /hospital access/i, level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /doctor login/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /doctor signup/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /nurse login/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /admin login/i })).toBeInTheDocument();
});
