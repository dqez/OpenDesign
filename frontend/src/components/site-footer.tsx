type FooterLink = readonly [label: string, href: string];

const productLinks: FooterLink[] = [
  ["Tokens", "/#tokens"],
  ["Process", "/#process"],
  ["Output", "/#output"],
];

const artifactLinks: FooterLink[] = [
  ["tokens.json", "/#output"],
  ["DESIGN.md", "/#output"],
  ["Brand guide", "/#output"],
];

const companyLinks: FooterLink[] = [
  ["About", "/about"],
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <section className="footer-cta-panel" aria-labelledby="footer-title">
        <div className="footer-cta-copy">
          <p className="section-kicker">Design memory starts here</p>
          <h2 id="footer-title">
            Keep extracted design memory close to the build.
          </h2>
          <p>
            Capture the visible system of a live website before the next
            implementation pass.
          </p>
        </div>
        <a className="footer-primary" href="/#extract">
          Paste URL
        </a>
      </section>

      <div className="footer-directory">
        <div className="footer-brand-block">
          <a className="footer-logo" href="/">
            2Design
          </a>
          <p>
            Token extraction for teams that need practical design context in
            code, not another static moodboard.
          </p>
        </div>

        <nav className="footer-link-grid" aria-label="Footer navigation">
          <FooterGroup title="Product" links={productLinks} />
          <FooterGroup title="Artifacts" links={artifactLinks} />
          <FooterGroup title="Company" links={companyLinks} />
        </nav>
      </div>

      <div className="footer-bottom">
        <span>(c) 2026 2Design</span>
        <span>URL in. Tokens out. Review before handoff.</span>
      </div>
    </footer>
  );
}

function FooterGroup({ links, title }: { links: FooterLink[]; title: string }) {
  return (
    <div className="footer-link-group">
      <span>{title}</span>
      {links.map(([label, href]) => (
        <a href={href} key={label}>
          {label}
        </a>
      ))}
    </div>
  );
}
