import type { DesignCatalogItem } from "./api";

export function findDesignBySlug(items: DesignCatalogItem[], slug: string) {
  return items.find((item) => item.slug === slug) ?? null;
}

export async function fetchTextArtifact(url?: string) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.text();
  } catch (err) {
    console.warn("Text artifact failed to load", err);
    return null;
  }
}

export async function fetchJsonArtifact(url?: string) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    console.warn("JSON artifact failed to load", err);
    return null;
  }
}
