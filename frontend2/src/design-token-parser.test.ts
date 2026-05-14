import { describe, expect, it } from "vitest";
import {
  createDesignPreviewModel,
  extractColors,
  extractDimensions,
} from "./design-token-parser";

describe("design token parser", () => {
  it("extracts DTCG color values with hex objects", () => {
    const colors = extractColors({
      color: {
        palette: {
          primary: {
            $value: { hex: "#0066b1" },
            $description: "Brand blue",
          },
        },
      },
    });

    expect(colors).toEqual([
      {
        name: "color.palette.primary",
        hex: "#0066b1",
        description: "Brand blue",
      },
    ]);
  });

  it("extracts legacy string hex values", () => {
    expect(
      extractColors({ color: { black: { value: "#000000" } } }),
    ).toMatchObject([{ name: "color.black", hex: "#000000" }]);
  });

  it("extracts and clamps dimensions", () => {
    const dimensions = extractDimensions(
      {
        tight: { $value: { value: 4, unit: "px" } },
        absurd: { $value: { value: 33554400, unit: "px" } },
      },
      48,
    );

    expect(dimensions).toEqual([
      { name: "tight", value: 4, unit: "px", css: "4px" },
      { name: "absurd", value: 48, unit: "px", css: "48px" },
    ]);
  });

  it("creates a compact preview model", () => {
    const model = createDesignPreviewModel({
      typography: {
        "font-family": {
          inter: { $value: "Inter" },
        },
        style: {
          display: {
            $value: {
              fontFamily: "{typography.font-family.inter}",
              fontSize: { $value: { value: 56, unit: "px" } },
              fontWeight: { $value: 700 },
              lineHeight: { $value: 1.05 },
            },
          },
        },
      },
      spacing: {
        sm: { $value: { value: 8, unit: "px" } },
      },
    });

    expect(model.fonts).toEqual([{ name: "inter", value: "Inter" }]);
    expect(model.typography).toMatchObject([
      { name: "display", fontSize: "56px", fontWeight: 700 },
    ]);
    expect(model.spacing).toEqual([{ name: "sm", value: 8, unit: "px", css: "8px" }]);
  });
});
