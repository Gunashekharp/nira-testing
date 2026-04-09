import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../app/App";
import { DemoDataProvider } from "../app/DemoDataProvider";

export function renderApp(route = "/") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <DemoDataProvider>
        <App />
      </DemoDataProvider>
    </MemoryRouter>
  );
}
