import { expect, it } from "vitest";
import { createDesignPreviewModel } from "../design-token-parser";

it("creates a preview model from DTCG token trees", () => {
  const model = createDesignPreviewModel({
    color: { primary: { $value: "#115533", $type: "color" } },
    spacing: { sm: { value: { value: 8, unit: "px" }, type: "dimension" } },
    radius: { md: { value: { value: 12, unit: "px" }, type: "dimension" } },
  });

  expect(model.colors).toEqual([{ name: "color.primary", hex: "#115533" }]);
  expect(model.spacing).toEqual([{ name: "sm", value: 8, unit: "px", css: "8px" }]);
  expect(model.radii).toEqual([{ name: "md", value: 12, unit: "px", css: "12px" }]);
});

it("ignores primitive metadata values in token trees", () => {
  const model = createDesignPreviewModel({
    $extensions: {
      "com.dembrandt": {
        url: "https://senlyzer.vn/",
      },
    },
    color: { primary: { $value: "#115533", $type: "color" } },
  });

  expect(model.colors).toEqual([{ name: "color.primary", hex: "#115533" }]);
});
