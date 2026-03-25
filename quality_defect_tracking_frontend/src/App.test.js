import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

test("renders dashboard title", () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  // Dashboard appears both in the navbar link and as the page <h1>.
  // Use an unambiguous, accessible query to target the actual page title.
  const title = screen.getByRole("heading", { name: /dashboard/i, level: 1 });
  expect(title).toBeInTheDocument();
});
