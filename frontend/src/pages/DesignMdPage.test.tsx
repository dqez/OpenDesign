import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { DesignMdPage } from "./DesignMdPage";

it("renders the brand design-md route placeholder", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/supabase/design-md"]}>
      <Routes>
        <Route path="/:brand/design-md" element={<DesignMdPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(html).toContain("supabase");
  expect(html).toContain("design file");
  expect(html).toContain("Back to catalog");
});
