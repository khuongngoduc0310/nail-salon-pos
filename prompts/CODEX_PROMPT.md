# Codex Prompt

Use this prompt when starting a Codex session.

```text
You are building a local-first nail salon POS system. Read all files in this repository before coding.

Source of truth:
- docs/PRODUCT_REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/IMPLEMENTATION_PLAN.md
- db/SCHEMA.sql
- api/API_SPEC.md
- workflows/*.md
- tests/TEST_PLAN.md

Important requirements:
- Single-store nail salon.
- Owner POS runs on Windows/iPad as a web app.
- Worker app is a PWA for iPhone, no App Store.
- Customer booking/check-in is a web/PWA app.
- Services are not inventory.
- Owner manually decides worker assignment; POS only suggests.
- POS tracks turns taken and active service status.
- Turn count increases when service starts.
- Workers have different fixed commission rates.
- Worker keeps 100% of tips.
- Commission rate must be snapshotted at checkout time.
- Checkout supports cash, Clover card, gift card, split payments, tips, discounts, refunds.
- The salon has a Clover Mini.
- Use Clover REST Pay Display API later, but start with a mock terminal adapter.
- POS owns services/workers/turns/sales/reports/receipts. Clover owns card processing only.
- Local POS must keep working during internet outage for in-store workflows.
- Never store full card number, CVV, PIN, magstripe data, or raw EMV data.

Build incrementally:
1. Create database migrations based on db/SCHEMA.sql.
2. Implement backend domain logic and tests first.
3. Implement owner POS UI.
4. Implement worker/customer PWAs.
5. Implement mock terminal and mock printer.
6. Only after tests pass, implement Clover adapter behind the PaymentTerminalAdapter interface.

Before writing code, propose a concise file/folder structure and first implementation milestone.
```
