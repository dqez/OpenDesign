export type DesignObject = {
  key: string;
  uploaded?: Date;
};

export type DesignCatalogEntry = {
  slug: string;
  brand: string;
  sourceUrl: string;
  key: string;
  updatedAt?: string;
};

export function buildDesignCatalog(objects: DesignObject[]) {
  const latestBySlug = new Map<string, DesignCatalogEntry>();

  for (const object of objects) {
    if (!object.key.endsWith("/DESIGN.md")) continue;

    const domain = object.key.split("/")[0];
    if (!domain) continue;

    const slug = domainToSlug(domain);
    const entry = {
      slug,
      brand: slugToBrand(slug),
      sourceUrl: `https://${domain}`,
      key: object.key,
      updatedAt: object.uploaded?.toISOString(),
    };
    const existing = latestBySlug.get(slug);
    if (!existing || (entry.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      latestBySlug.set(slug, entry);
    }
  }

  return [...latestBySlug.values()].sort((a, b) =>
    a.brand.localeCompare(b.brand),
  );
}

function domainToSlug(domain: string) {
  const clean = domain.replace(/^www\./, "").toLowerCase();
  const withoutTld = clean.replace(/\.[a-z]{2,}$/, "");
  return withoutTld.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugToBrand(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
