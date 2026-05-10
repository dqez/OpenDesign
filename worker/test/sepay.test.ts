import { expect, it } from "vitest";
import {
  buildSePayQrUrl,
  classifySePayAmount,
  extractOrderCodeFromWebhook,
  isAllowedSePayIp,
  isExpectedSePayAccount,
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

it("normalizes order codes from lowercase webhook code", () => {
  expect(
    extractOrderCodeFromWebhook({ code: "2d-a1b2c3", content: "ignored" }),
  ).toBe("2D-A1B2C3");
});

it("extracts order code from transformed bank memo content", () => {
  expect(
    extractOrderCodeFromWebhook({
      code: null,
      content: "BankAPINotify chuyen tien 2d-a1b2c3 thanh toan",
    }),
  ).toBe("2D-A1B2C3");
});

it("extracts order code from bank memo content without dash", () => {
  expect(
    extractOrderCodeFromWebhook({
      code: null,
      content: "BankAPINotify chuyen tien 2DCWQQGM thanh toan",
    }),
  ).toBe("2D-CWQQGM");
});

it("rejects invalid order-code-like content", () => {
  expect(
    extractOrderCodeFromWebhook({
      code: null,
      content: "payment 2D-ABC",
    }),
  ).toBeNull();
});

it("detects exact and overpaid SePay amounts", () => {
  expect(classifySePayAmount(25000, 25000)).toBe("paid");
  expect(classifySePayAmount(30000, 25000)).toBe("overpaid");
  expect(classifySePayAmount(20000, 25000)).toBe("underpaid");
});

it("verifies recipient account when SePay sends accountNumber", () => {
  expect(isExpectedSePayAccount("0123456789", "0123456789")).toBe(true);
  expect(isExpectedSePayAccount("0000000000", "0123456789")).toBe(false);
  expect(isExpectedSePayAccount(undefined, "0123456789")).toBe(true);
});

it("allows only PRD SePay webhook IPs", () => {
  expect(isAllowedSePayIp("172.236.138.20")).toBe(true);
  expect(isAllowedSePayIp("203.0.113.10")).toBe(false);
});

it("accepts Authorization Apikey header", () => {
  expect(verifySePayAuthorization("Apikey secret", "secret")).toBe(true);
  expect(verifySePayAuthorization("Bearer secret", "secret")).toBe(false);
});
