import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { findDesignBySlug } from "../design-artifacts";
import { DesignMdPage } from "./DesignMdPage";

describe("DesignMdPage", () => {
  it("renders the loading detail shell before artifacts load", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/supabase/design-md"]}>
        <Routes>
          <Route path="/:brand/design-md" element={<DesignMdPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain("Loading design system");
    expect(html).toContain("Back to catalog");
  });

  it("finds catalog items by route slug", () => {
    expect(
      findDesignBySlug(
        [
          { slug: "neon", brand: "Neon", sourceUrl: "https://neon.com" },
          {
            slug: "senlyzer",
            brand: "Senlyzer",
            sourceUrl: "https://senlyzer.vn",
          },
        ],
        "senlyzer",
      ),
    ).toMatchObject({ brand: "Senlyzer" });
  });
});
