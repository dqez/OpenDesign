import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExtraction, getOrderStatus, type ExtractResponse } from "../api";
import { DesignCatalog } from "../components/design-catalog";
import { PinnedProcess } from "../components/pinned-process";
import { SiteFooter } from "../components/site-footer";
import { TokenBento } from "../components/TokenBento";

type PaymentResponse = Extract<ExtractResponse, { requiresPayment: true }>;

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
          <a href="#catalog">Catalog</a>
          <a href="#extract">New URL</a>
          <a href="#process">Process</a>
        </div>
      </nav>

      <DesignCatalog />

      <section className="extract-section" id="extract">
        <div className="hero-copy">
          <p className="section-kicker">Add another URL</p>
          <h2>Extract design tokens from a new site</h2>
        </div>
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

      <PinnedProcess />
      <TokenBento />
      <SiteFooter />
    </main>
  );
}
