import { LegalFactList, LegalList, LegalPage, LegalSection } from "./legal-page";

const updatedAt = "May 15, 2026";

export function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of Service"
      summary="These terms explain how you may use OpenDesign, what the service provides, and the responsibilities that come with submitting URLs and using generated artifacts."
      updatedAt={updatedAt}
      aside={
        <LegalFactList
          items={[
            { label: "Current paid flow", value: "SePay QR bank transfer" },
            { label: "Default paid amount", value: "25,000 VND after the free use" },
            { label: "Default order window", value: "24 hours" },
            { label: "Generated files", value: "tokens.json, DESIGN.md, brand-guide.pdf" },
          ]}
        />
      }
    >
      <LegalSection title="1. Acceptance">
        <p>
          By accessing OpenDesign, submitting an extraction request, or using a
          generated artifact, you agree to these terms. If you use the service
          for a company or client, you confirm that you have authority to do so.
        </p>
      </LegalSection>

      <LegalSection title="2. Service">
        <p>
          OpenDesign converts public website URLs into design reference files.
          The service may provide a free extraction for initial use and require
          payment for later requests. Paid jobs start after payment is confirmed
          by the payment webhook.
        </p>
      </LegalSection>

      <LegalSection title="3. Your Submissions">
        <p>
          You are responsible for each URL and email address you submit. Submit
          only public pages that can be accessed without credentials, private
          tokens, or bypassing access controls.
        </p>
        <LegalList
          items={[
            "Do not submit private, confidential, or regulated personal information.",
            "Do not submit pages that you are not allowed to process.",
            "Do not use the service to overload, probe, or attack another website.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Payments and Delivery">
        <p>
          When payment is required, the app shows the amount, currency, bank
          details, order code, and QR code before the job is created. The
          current default paid extraction amount is 25,000 VND, but the amount
          shown at checkout controls your specific order.
        </p>
        <p>
          Digital artifacts are delivered through signed download links and may
          also be sent by email. Signed links are temporary. If OpenDesign cannot
          create or deliver a paid job because of a service-side failure, contact
          the operator for support. Fees are otherwise non-refundable except
          where required by law.
        </p>
      </LegalSection>

      <LegalSection title="5. Artifact License">
        <p>
          Subject to these terms, you may use generated OpenDesign artifacts as
          reference material for websites, applications, and internal design
          work that you own or are authorized to build.
        </p>
        <LegalList
          items={[
            "You may not resell generated files as a standalone dataset, template, or competing extraction product.",
            "You may not use artifacts to impersonate a third-party brand or copy protected logos, images, text, or source code.",
            "You remain responsible for reviewing the artifacts before using them in production.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Intellectual Property">
        <p>
          OpenDesign output is an independent analysis of publicly observable
          visual patterns. It does not grant rights to third-party trademarks,
          copyrighted content, trade dress, logos, photography, or proprietary
          design systems.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable Use">
        <LegalList
          items={[
            "Do not violate law, intellectual property rights, privacy rights, or third-party contracts.",
            "Do not bypass rate limits, payment checks, webhook protections, or access controls.",
            "Do not introduce malware, abusive traffic, or automated scraping of the service.",
            "Do not interfere with the availability, security, or integrity of OpenDesign.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          OpenDesign and all generated artifacts are provided as available. The
          extractor may miss details, misread pages, or produce incomplete
          design guidance. You are responsible for validating accuracy,
          accessibility, legal clearance, and production suitability.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes and Contact">
        <p>
          These terms may be updated as the product changes. Continued use after
          an update means you accept the revised terms. For operational,
          copyright, or payment questions, contact the support address provided
          by the OpenDesign deployment or in your delivery email.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
