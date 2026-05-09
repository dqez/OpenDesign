import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { Home } from "./Home";

it("renders the website redesign content shell", () => {
  const html = renderToString(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

  expect(html).toContain("Extract design tokens from any URL");
  expect(html).toContain("Specimen tray");
  expect(html).toContain("From URL to DESIGN.md");
  expect(html).toContain("What you get");
  expect(html).toContain("Brand guide");
  expect(html).toContain("Design memory starts here");
  expect(html).toContain("Company");
  expect(html).toContain("About");
  expect(html).toContain("Terms");
  expect(html).toContain("Privacy");
  expect(html).toContain("Paste URL");
});
