import { expect, it, vi } from "vitest";

const send = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null }),
);

vi.mock("resend", () => ({
  Resend: class Resend {
    emails = { send };
  },
}));

const { sendCompletionEmail } = await import("../src/services/email");

it("sends completion email with expiring download links", async () => {
  await sendCompletionEmail({
    apiKey: "resend-secret",
    to: "user@example.com",
    downloadUrls: {
      tokens: "https://signed/tokens",
      designMd: "https://signed/design",
      brandGuide: "https://signed/pdf",
    },
  });

  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "user@example.com",
      subject: "Your OpenDesign extraction is ready",
      html: expect.stringContaining("https://signed/tokens"),
    }),
  );
});
