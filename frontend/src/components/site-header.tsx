import { Link } from "react-router-dom";
import { appConfig } from "../app-config";

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="brand-mark" to="/">
          <span className="brand-glyph" aria-hidden="true">
            {appConfig.appGlyph}
          </span>
          <span>{appConfig.appName}</span>
        </Link>

        <div className="nav-links">
          <a href="/#catalog">Catalog</a>
          <a className="nav-cta" href="/#extract">
            Extract URL
          </a>
          <a href="/#process">Process</a>
        </div>
      </nav>
    </header>
  );
}
