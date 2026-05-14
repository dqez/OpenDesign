import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { Preview } from "./Preview";

it("renders a designed loading state before preview files resolve", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/jobs/job_123/preview"]}>
      <Routes>
        <Route path="/jobs/:jobId/preview" element={<Preview />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(html).toContain("Artifact preview");
  expect(html).toContain("Loading fullscreen preview");
});
