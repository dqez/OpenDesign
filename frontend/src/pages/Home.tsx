import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExtraction, getOrderStatus, type ExtractResponse } from "../api";
import { DesignCatalog } from "../components/design-catalog";
import { ExtractProgressToast } from "../components/extract-progress-toast";
import { PinnedProcess } from "../components/pinned-process";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { TokenBento } from "../components/TokenBento";
import { upsertClientJob } from "../client-jobs";

type PaymentResponse = Extract<ExtractResponse, { requiresPayment: true }>;

export function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [paymentJobInput, setPaymentJobInput] = useState<{
    url: string;
    email: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const submittedUrl = url.trim();
      const submittedEmail = email.trim();
      const response = await createExtraction({
        url: submittedUrl,
        email: submittedEmail,
      });
      if ("requiresPayment" in response) {
        setPaymentJobInput({ url: submittedUrl, email: submittedEmail });
        setPayment(response);
      } else {
        upsertClientJob({
          jobId: response.jobId,
          url: submittedUrl,
          email: submittedEmail,
          status: response.status,
        });
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
          if (paymentJobInput) {
            upsertClientJob({
              jobId: status.jobId,
              url: paymentJobInput.url,
              email: paymentJobInput.email,
              status: "queued",
            });
          }
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
  }, [navigate, payment, paymentJobInput]);

  return (
    <main className="site-shell">
      <SiteHeader />

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
          <img
            src={payment.qrUrl}
            alt={`Payment QR for ${payment.orderCode}`}
          />
          <dl>
            <dt>Order</dt>
            <dd>{payment.orderCode}</dd>
            <dt>Amount</dt>
            <dd>
              {payment.amount.toLocaleString("vi-VN")} {payment.currency}
            </dd>
            <dt>Bank</dt>
            <dd>{payment.bankInfo.bank}</dd>
            <dt>Account</dt>
            <dd>{payment.bankInfo.accountNumber}</dd>
            <dt>Content</dt>
            <dd>{payment.bankInfo.content}</dd>
          </dl>
        </section>
      ) : null}

      <TokenBento />
      <PinnedProcess />
      <SiteFooter />
      <ExtractProgressToast />
    </main>
  );
}
