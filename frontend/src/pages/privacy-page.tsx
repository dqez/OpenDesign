import { LegalFactList, LegalList, LegalPage, LegalSection } from "./legal-page";

const updatedAt = "May 15, 2026";

export function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="This policy describes the data OpenDesign uses to create extraction jobs, process payment status, deliver artifacts, and protect the service."
      updatedAt={updatedAt}
      aside={
        <LegalFactList
          items={[
            { label: "Required input", value: "Website URL and email address" },
            { label: "Payment data", value: "Order code and SePay webhook metadata" },
            { label: "Browser storage", value: "Local job tracking in localStorage" },
            { label: "Download links", value: "Signed R2 links expire after about 24 hours" },
          ]}
        />
      }
    >
      <LegalSection title="1. Data We Collect">
        <p>
          OpenDesign collects the information needed to run and deliver an
          extraction job: the public URL you submit, your email address, job
          status, order status, and generated artifact paths. The API also uses
          a hashed IP value for free-use tracking, abuse prevention, and rate
          limiting.
        </p>
      </LegalSection>

      <LegalSection title="2. Payment Information">
        <p>
          Paid jobs are handled through SePay QR bank transfer. OpenDesign stores
          order details such as amount, currency, order code, status, paid time,
          and webhook records. It does not collect or store credit card numbers.
        </p>
      </LegalSection>

      <LegalSection title="3. Generated Artifacts">
        <p>
          The extractor creates files such as tokens.json, DESIGN.md, and
          brand-guide.pdf. These files are uploaded to object storage and served
          through temporary signed links so you can preview or download them.
        </p>
      </LegalSection>

      <LegalSection title="4. How We Use Data">
        <LegalList
          items={[
            "Validate extraction requests and prevent malformed submissions.",
            "Queue, run, and track extraction jobs.",
            "Confirm paid orders and connect them to jobs.",
            "Send completion emails with artifact links.",
            "Operate rate limits, audit events, payment reconciliation, and service security.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Local Browser Storage">
        <p>
          The frontend stores recent job tracking information in your browser's
          localStorage so the home page can continue showing extraction progress.
          This is local to your browser and can be cleared through your browser
          settings.
        </p>
      </LegalSection>

      <LegalSection title="6. Service Providers">
        <p>
          OpenDesign relies on infrastructure and service providers to operate
          the product. Current code paths use Cloudflare for Worker hosting,
          D1/KV/R2 storage, Queues, and Pages; SePay and the receiving bank for
          bank-transfer confirmation; Resend for delivery email; and an
          extractor service to process submitted public URLs.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          Job, order, payment, webhook, audit, and email records are retained as
          needed to deliver artifacts, support users, prevent abuse, reconcile
          payments, and meet legal or accounting obligations. Temporary signed
          artifact links expire, but the underlying records and stored files may
          remain until removed by the operator.
        </p>
      </LegalSection>

      <LegalSection title="8. Your Choices">
        <LegalList
          items={[
            "You can avoid submitting a URL or email if you do not want a job created.",
            "You can clear local job history from your browser storage.",
            "You can request help, correction, or deletion through the support address provided by the deployment or delivery email.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          OpenDesign uses validation, rate limits, hashed IP tracking, webhook
          authorization, signed artifact URLs, and provider access controls to
          protect the service. No internet service can guarantee perfect
          security, so avoid submitting confidential URLs or sensitive data.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          This policy may be updated when OpenDesign changes how it collects,
          processes, or stores data. Updates are effective when posted on this
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
