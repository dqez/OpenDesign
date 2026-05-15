import { appConfig } from "../app-config";
import { LegalFactList, LegalPage, LegalSection } from "./legal-page";

export function AboutPage() {
  return (
    <LegalPage
      eyebrow="About OpenDesign"
      title="Design memory for frontend teams."
      summary="OpenDesign turns a public website URL into practical design artifacts that help designers, developers, and agencies understand a visible design system before they build."
      aside={
        <LegalFactList
          items={[
            { label: "Input", value: "Public website URL and delivery email" },
            { label: "Artifacts", value: "tokens.json, DESIGN.md, brand-guide.pdf" },
            { label: "Use case", value: "Reference material for your own UI work" },
            { label: "Storage", value: "Cloudflare D1, KV, R2, Queue, and Worker APIs" },
          ]}
        />
      }
    >
      <LegalSection title="What OpenDesign Does">
        <p>
          {appConfig.appName} extracts observable design signals from public
          websites: color usage, typography, spacing, layout notes, and
          generated brand guidance. The output is meant to sit beside your code
          as design context, not as a replacement for product strategy,
          ownership, or review by a designer.
        </p>
        <p>
          The current app accepts a URL and email, creates an extraction job,
          runs the extractor service, stores generated files, and returns signed
          download links when the job is complete.
        </p>
      </LegalSection>

      <LegalSection title="What You Receive">
        <p>
          A completed extraction can include a token file for implementation, a
          DESIGN.md file for agent-readable design notes, and a PDF brand guide
          for human review. These files are starting points. You should inspect
          and adapt them before using them in production.
        </p>
      </LegalSection>

      <LegalSection title="Independence">
        <p>
          OpenDesign analyses public pages independently. It is not affiliated
          with, endorsed by, or sponsored by the brands, websites, or companies
          you submit or see in the catalog. Trademarks and brand assets remain
          the property of their respective owners.
        </p>
      </LegalSection>

      <LegalSection title="Responsible Use">
        <p>
          Use OpenDesign to understand patterns and improve your own work. Do
          not use generated artifacts to impersonate another company, copy
          protected assets, reproduce proprietary source material, or create a
          confusingly similar brand experience.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
