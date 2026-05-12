import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { RawDesignMdPanel } from "./raw-design-md-panel";

it("renders raw DESIGN.md content and actions", () => {
  const html = renderToString(
    <RawDesignMdPanel
      markdown={"# Design System\n\n## Colors"}
      downloadUrl="https://r2.example/DESIGN.md"
    />,
  );

  expect(html).toContain("# Design System");
  expect(html).toContain("Copy");
  expect(html).toContain("Download");
});
