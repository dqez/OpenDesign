import { Resend } from "resend";

export async function sendCompletionEmail(input: {
  apiKey: string;
  to: string;
  downloadUrls: { tokens: string; designMd: string; brandGuide: string };
}) {
  const resend = new Resend(input.apiKey);
  return resend.emails.send({
    from: "2Design <no-reply@2design.dqez.dev>",
    to: input.to,
    subject: "Your 2Design extraction is ready",
    html: [
      "<p>Your extraction is ready. These links expire in 24 hours.</p>",
      "<ul>",
      // `<li><a href="${input.downloadUrls.tokens}">tokens.json</a></li>`,
      `<li><a href="${input.downloadUrls.designMd}">DESIGN.md</a></li>`,
      `<li><a href="${input.downloadUrls.brandGuide}">brand-guide.pdf</a></li>`,
      "</ul>",
    ].join(""),
  });
}
