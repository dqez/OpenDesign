import { expect, it } from "vitest";
import { flattenTokens } from "./Preview";

it("flattens DTCG token trees", () => {
  expect(
    flattenTokens({
      color: { primary: { $value: "#115533", $type: "color" } },
      spacing: { sm: { value: "8px", type: "dimension" } },
    }),
  ).toEqual([
    { name: "color.primary", value: "#115533", type: "color" },
    { name: "spacing.sm", value: "8px", type: "dimension" },
  ]);
});

it("ignores primitive metadata values in token trees", () => {
  expect(
    flattenTokens({
      $extensions: {
        "com.dembrandt": {
          url: "https://senlyzer.vn/",
        },
      },
      color: { primary: { $value: "#115533", $type: "color" } },
    }),
  ).toEqual([{ name: "color.primary", value: "#115533", type: "color" }]);
});
