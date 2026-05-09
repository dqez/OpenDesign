import { Hono } from "hono";
import { buildDesignCatalog } from "../services/design-catalog";
import { createSignedGetUrl } from "../services/r2";
import type { Env } from "../types";

export const designsRoute = new Hono<{ Bindings: Env }>().get(
  "/designs",
  async (c) => {
    const objects: R2Object[] = [];
    let cursor: string | undefined;

    do {
      const listed = await c.env.R2.list({ cursor });
      objects.push(...listed.objects);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const catalog = buildDesignCatalog(objects);
    const objectKeys = new Set(objects.map((object) => object.key));
    const response = await Promise.all(
      catalog.map(async ({ key, ...entry }) => {
        const folder = key.replace(/\/DESIGN\.md$/, "");
        const tokensKey = `${folder}/tokens.json`;
        if (!objectKeys.has(tokensKey)) return undefined;

        const brandGuideKey = `${folder}/brand-guide.pdf`;
        const item: {
          slug: string;
          brand: string;
          sourceUrl: string;
          updatedAt?: string;
          designMdUrl: string;
          tokensUrl: string;
          brandGuideUrl?: string;
        } = {
          ...entry,
          designMdUrl: await createSignedGetUrl(c.env, key),
          tokensUrl: await createSignedGetUrl(c.env, tokensKey),
        };

        if (objectKeys.has(brandGuideKey)) {
          item.brandGuideUrl = await createSignedGetUrl(c.env, brandGuideKey);
        }

        return item;
      }),
    );

    return c.json(response.filter((entry) => entry !== undefined));
  },
);
