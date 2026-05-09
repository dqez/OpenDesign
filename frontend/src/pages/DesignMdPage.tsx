import { Link, useParams } from "react-router-dom";

export function DesignMdPage() {
  const { brand = "" } = useParams();
  const label = brand ? brand.replaceAll("-", " ") : "selected brand";

  return (
    <main className="site-shell preview-layout">
      <section className="state-panel">
        <p className="section-kicker">DESIGN.md</p>
        <h1>{label} design file</h1>
        <p>
          This route is reserved for the R2-backed DESIGN.md viewer. The home
          catalog now links brands here while the detailed reader stays scoped
          for the next pass.
        </p>
        <Link className="status-link" to="/">
          Back to catalog
        </Link>
      </section>
    </main>
  );
}
