import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDesignCatalog, type DesignCatalogItem } from "../api";

export function DesignCatalog() {
  const [query, setQuery] = useState("");
  const [designs, setDesigns] = useState<DesignCatalogItem[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

  const filteredDesigns = designs.filter((design) => {
    const haystack = `${design.brand} ${design.sourceUrl}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    let active = true;
    async function loadDesigns() {
      try {
        const next = await getDesignCatalog();
        if (active) setDesigns(next);
      } catch (err) {
        if (active) {
          console.warn("Design catalog failed to load", err);
          setCatalogUnavailable(true);
        }
      } finally {
        if (active) setLoadingDesigns(false);
      }
    }
    void loadDesigns();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="catalog-hero" id="catalog">
        <div className="hero-copy">
          <p className="section-kicker">R2 Design Catalog</p>
          <h1>Browse extracted brand design files</h1>
          <p>
            Search the brands already processed into DESIGN.md artifacts, then
            open a clean URL like /supabase/design-md for the selected brand.
          </p>
        </div>
        <label className="catalog-search">
          Search brands
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="supabase, neon, gsap..."
          />
        </label>
      </section>

      <section className="brand-catalog" aria-label="Extracted brand designs">
        {loadingDesigns ? (
          <div className="catalog-state">
            <p className="section-kicker">Loading</p>
            <h2>Reading R2 catalog</h2>
            <div className="skeleton-lines" aria-hidden="true" />
          </div>
        ) : null}

        {catalogUnavailable ? (
          <div className="catalog-state catalog-state-soft">
            <p className="section-kicker">Saved designs</p>
            <h2>Saved brand files are not ready to browse yet.</h2>
            <p>You can still extract a new URL below.</p>
          </div>
        ) : null}

        {!loadingDesigns && !catalogUnavailable && filteredDesigns.length === 0 ? (
          <div className="catalog-state">
            <p className="section-kicker">No match</p>
            <h2>No extracted brand matches this search.</h2>
          </div>
        ) : null}

        {filteredDesigns.map((design) => (
          <Link
            className="brand-card"
            key={design.slug}
            to={`/${design.slug}/design-md`}
          >
            <span>{design.brand}</span>
            <code>{design.sourceUrl}</code>
            {design.updatedAt ? <time>{formatDate(design.updatedAt)}</time> : null}
          </Link>
        ))}
      </section>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
