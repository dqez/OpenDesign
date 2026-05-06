import { expect, it, vi } from "vitest";
import { expirePendingOrders } from "../src/services/db";

it("marks expired pending orders as expired", async () => {
  const run = vi.fn().mockResolvedValue({ meta: { changes: 2 } });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as D1Database;

  await expirePendingOrders(db, "2026-05-06T00:00:00.000Z");

  expect(prepare).toHaveBeenCalledWith(
    expect.stringContaining("UPDATE orders SET status = 'expired'"),
  );
  expect(bind).toHaveBeenCalledWith("2026-05-06T00:00:00.000Z");
  expect(run).toHaveBeenCalled();
});
