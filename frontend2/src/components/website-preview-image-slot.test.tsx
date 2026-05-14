import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { WebsitePreviewImageSlot } from "./website-preview-image-slot";

it("renders an empty website preview image slot", () => {
  const html = renderToString(<WebsitePreviewImageSlot />);

  expect(html).toContain("Website preview image slot");
  expect(html).toContain("Website preview image placeholder");
});
