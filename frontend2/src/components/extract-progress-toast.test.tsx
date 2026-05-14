import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtractProgressToast } from "./extract-progress-toast";

const clientJobs = [
  {
    jobId: "job_1",
    url: "https://example.com",
    email: "designer@example.com",
    status: "processing",
    createdAt: "2026-05-11T07:00:00.000Z",
    updatedAt: "2026-05-11T07:05:00.000Z",
  },
];

function stubWindowWithCollapsedState(isCollapsed: boolean): void {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => JSON.stringify(clientJobs),
      setItem: vi.fn(),
    },
    sessionStorage: {
      getItem: () => String(isCollapsed),
      setItem: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

function renderToast(): string {
  return renderToString(
    <MemoryRouter>
      <ExtractProgressToast />
    </MemoryRouter>,
  );
}

describe("ExtractProgressToast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders expanded job actions by default", () => {
    stubWindowWithCollapsedState(false);

    const html = renderToast();

    expect(html).toContain("Hide");
    expect(html).toContain("View status");
    expect(html).toContain("https://example.com");
  });

  it("renders compact summary when collapsed", () => {
    stubWindowWithCollapsedState(true);

    const html = renderToast();

    expect(html).toContain("Show");
    expect(html).toContain("1 job still running");
    expect(html).not.toContain("View status");
  });
});
