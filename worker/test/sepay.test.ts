import { expect, it } from "vitest";
import {
  buildSePayQrUrl,
  extractOrderCodeFromWebhook,
  isAllowedSePayIp,
  verifySePayAuthorization,
} from "../src/services/sepay";

it("builds QR URL with amount and order code", () => {
  const url = buildSePayQrUrl({
    bankName: "Vietcombank",
    accountNumber: "0123456789",
    amount: 25000,
    orderCode: "2D-A1B2C3",
  });
  expect(url).toContain("amount=25000");
  expect(url).toContain("des=2D-A1B2C3");
});

it("extracts order code from webhook code field first", () => {
  expect(
    extractOrderCodeFromWebhook({ code: "2D-A1B2C3", content: "ignored" }),
  ).toBe("2D-A1B2C3");
});

it("allows only PRD SePay webhook IPs", () => {
  expect(isAllowedSePayIp("172.236.138.20")).toBe(true);
  expect(isAllowedSePayIp("203.0.113.10")).toBe(false);
});

it("accepts Authorization Apikey header", () => {
  expect(verifySePayAuthorization("Apikey secret", "secret")).toBe(true);
  expect(verifySePayAuthorization("Bearer secret", "secret")).toBe(false);
});
