import { createCloverPaymentAdapter, loadCloverPaymentConfig } from "./index.js";

const command = process.argv[2] ?? "status";
const adapter = createCloverPaymentAdapter(loadCloverPaymentConfig());

if (command === "status") {
  const status = await adapter.verifyConnection();
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
} else if (command === "test-sale") {
  const amountCents = Number(process.argv[3] ?? 100);
  const result = await adapter.startCardSale({
    amountCents,
    idempotencyKey: `clover-dev-${Date.now()}`,
    enableTipOnDevice: true,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} else {
  console.error("Usage: pnpm clover:dev [status|test-sale <amountCents>]");
  process.exitCode = 1;
}
