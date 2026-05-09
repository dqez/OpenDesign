import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { Status } from "./Status";

it("renders a designed loading state before job data arrives", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/jobs/job_123"]}>
      <Routes>
        <Route path="/jobs/:jobId" element={<Status />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(html).toContain("Preparing specimen tray");
  expect(html).toContain("job_123");
});
