import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { Home } from "./Home";

it("renders the extracted brand catalog shell", () => {
  const html = renderToString(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

  expect(html).toContain("Browse extracted brand design files");
  expect(html).toContain("Search brands");
  expect(html).toContain("Reading R2 catalog");
  expect(html).toContain("Add another URL");
  expect(html).toContain("Extract design tokens from a new site");
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
