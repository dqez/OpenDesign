import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExtraction, getOrderStatus, type ExtractResponse } from "../api";
import { PinnedProcess } from "../components/pinned-process";
import { SiteFooter } from "../components/site-footer";
import { TokenBento } from "../components/TokenBento";

type PaymentResponse = Extract<ExtractResponse, { requiresPayment: true }>;

const tokenCards = [
  ["Color system", "Mineral swatches, contrast pairs, and semantic roles."],
  ["Type scale", "Display, body, mono, and practical line-height notes."],
  ["Spacing ruler", "Measured rhythm from gutters to component radius."],
  ["Agent files", "tokens.json, DESIGN.md, and a PDF brand guide."],
  ["Specimen tray", "A preview built for human review before agent handoff."],
];

const specimenRows = [
  ["ink", "#171815"],
  ["accent", "#2f6f59"],
  ["surface", "#ffffff"],
  ["radius", "14px"],
];

export function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await createExtraction({ url, email });
      if ("requiresPayment" in response) {
        setPayment(response);
      } else {
        navigate(`/jobs/${response.jobId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!payment) return;

    const timer = window.setInterval(async () => {
      try {
        const status = await getOrderStatus(payment.orderCode);
        if (status.jobId) {
          window.clearInterval(timer);
          navigate(`/jobs/${status.jobId}`);
        }
        if (status.status === "expired" || status.status === "cancelled") {
          window.clearInterval(timer);
          setError(`Payment order ${status.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Order status failed");
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [navigate, payment]);

  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand-mark" href="/">
          2Design
        </a>
        <div className="nav-links">
          <a href="#tokens">Tokens</a>
          <a href="#process">Process</a>
          <a href="#extract">Extract</a>
        </div>
      </nav>

      <section className="hero-section" id="extract">
        <div className="hero-copy">
          <p className="section-kicker">Specimen Lab for Design Tokens</p>
          <h1>Extract design tokens from any URL</h1>
          <p>
            Paste a live website, then review the separated color, type,
            spacing, radius, and agent-ready artifacts before using them in a
            build.
          </p>
          <form className="extract-panel" onSubmit={onSubmit}>
            <label>
              Website URL
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://neon.com"
                required
              />
            </label>
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                type="email"
                required
              />
            </label>
            <button disabled={submitting}>
              {submitting ? "Preparing specimen" : "Extract tokens"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </div>

        <aside className="specimen-panel" aria-label="Sample specimen tray">
          <div className="specimen-header">
            <span>Specimen tray</span>
            <code>tokens.json</code>
          </div>
          <div className="specimen-swatches">
            <span />
            <span />
            <span />
          </div>
          <dl className="specimen-list">
            {specimenRows.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      {payment ? (
        <section className="payment-panel">
          <div>
            <p className="section-kicker">Payment receipt</p>
            <h2>Scan the QR code to start the extraction job.</h2>
          </div>
          <img src={payment.qrUrl} alt={`Payment QR for ${payment.orderCode}`} />
          <dl>
            <dt>Order</dt>
            <dd>{payment.orderCode}</dd>
            <dt>Amount</dt>
            <dd>{payment.amount.toLocaleString("vi-VN")} VND</dd>
            <dt>Bank</dt>
            <dd>{payment.bankInfo.bank}</dd>
            <dt>Account</dt>
            <dd>{payment.bankInfo.accountNumber}</dd>
            <dt>Content</dt>
            <dd>{payment.bankInfo.content}</dd>
          </dl>
        </section>
      ) : null}

      <section className="token-bento" id="tokens">
        {tokenCards.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <PinnedProcess />
      <TokenBento />
      <SiteFooter />
    </main>
  );
}
