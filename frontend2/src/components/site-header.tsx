import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appConfig } from "../app-config";

export function SiteHeader() {
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 60) {
        if (currentScrollY > lastScrollY) {
          setIsHeaderHidden(true); // scrolling down
        } else {
          setIsHeaderHidden(false); // scrolling up
        }
      } else {
        setIsHeaderHidden(false); // at top
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`site-header ${isHeaderHidden ? "is-hidden" : ""}`}>
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="brand-mark" to="/">
          {/* <span className="brand-glyph" aria-hidden="true">
            {appConfig.appGlyph}
          </span> */}
          <span className="brand-wordmark field-label">
            {renderWordmark(appConfig.appName)}
          </span>
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
      <span className="brand-name-secondary">{appName.slice(designIndex)}</span>
    </>
  );
}
