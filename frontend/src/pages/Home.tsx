import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExtraction, getOrderStatus, type ExtractResponse } from "../api";

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
    <main className="app-shell">
      <section className="workspace">
        <form className="extract-panel" onSubmit={onSubmit}>
          <div className="panel-heading">
            <p className="eyebrow">2Design</p>
            <h1>Extract brand tokens from a website</h1>
          </div>
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
            {submitting ? "Submitting" : "Extract"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
        {payment ? (
          <section className="payment-panel">
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
      </section>
    </main>
  );
}
