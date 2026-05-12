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
          <span className="brand-wordmark">{renderWordmark(appConfig.appName)}</span>
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

function renderWordmark(appName: string) {
  const designIndex = appName.toLowerCase().indexOf("design");
  if (designIndex <= 0) return appName;

  return (
    <>
      <span className="brand-name-primary">
        {appName.slice(0, designIndex)}
      </span>
      <span className="brand-name-secondary">
        {appName.slice(designIndex)}
      </span>
    </>
  );
}
