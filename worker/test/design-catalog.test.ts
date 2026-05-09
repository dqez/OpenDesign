import { describe, expect, it } from "vitest";
import { buildDesignCatalog } from "../src/services/design-catalog";

describe("buildDesignCatalog", () => {
  it("returns one latest DESIGN.md entry per brand slug", () => {
    const catalog = buildDesignCatalog([
      {
        key: "supabase.com/job_old/DESIGN.md",
        uploaded: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        key: "supabase.com/job_new/DESIGN.md",
        uploaded: new Date("2026-05-02T00:00:00.000Z"),
      },
      {
        key: "gsap.com/job_1/tokens.json",
        uploaded: new Date("2026-05-03T00:00:00.000Z"),
      },
      {
        key: "neon.com/job_1/DESIGN.md",
        uploaded: new Date("2026-05-03T00:00:00.000Z"),
      },
    ]);

    expect(catalog).toEqual([
      expect.objectContaining({ slug: "neon", brand: "Neon" }),
      expect.objectContaining({
        slug: "supabase",
        key: "supabase.com/job_new/DESIGN.md",
      }),
    ]);
  });
});
