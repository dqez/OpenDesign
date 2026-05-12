import { DEFAULT_APP_NAME, DEFAULT_EMAIL_FROM } from "../config";
import { Resend } from "resend";

export async function sendCompletionEmail(input: {
  apiKey: string;
  to: string;
  downloadUrls: { tokens: string; designMd: string; brandGuide: string };
  appName?: string;
  emailFrom?: string;
}) {
  const resend = new Resend(input.apiKey);
  const appName = input.appName?.trim() || DEFAULT_APP_NAME;
  return resend.emails.send({
    from: input.emailFrom?.trim() || DEFAULT_EMAIL_FROM,
    to: input.to,
    subject: `Your ${appName} extraction is ready`,
    html: [
      "<p>Your extraction is ready. These links expire in 24 hours.</p>",
      "<ul>",
      `<li><a href="${input.downloadUrls.designMd}">DESIGN.md</a></li>`,
      `<li><a href="${input.downloadUrls.brandGuide}">brand-guide.pdf</a></li>`,
      "</ul>",
    ].join(""),
  });
}
