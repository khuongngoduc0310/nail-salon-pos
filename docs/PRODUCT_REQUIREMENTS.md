# Product Requirements — Nail Salon POS

## Goal

Build a local-first POS and appointment system for a single-store nail salon.

The system must support:

- Owner checkout and reporting.
- Worker turn tracking and worker earnings.
- Customer check-in and online appointment booking.
- Clover Mini card terminal integration.
- Printed receipt now, SMS/email receipt later.
- Local in-store operation during internet outage.

## Users and permissions

### Owner

Owner can:

- Use the owner POS floor, assignment, and checkout flows without repeated PIN entry.
- Enter owner PIN only for secure areas/actions such as service management, worker management, reports, end-of-day close, refunds, and protected settings.
- Manage services and service categories.
- Manage workers and commission rates.
- View all worker turns.
- Assign customers to workers.
- Start/end service turns.
- Checkout customers.
- Apply discounts.
- Process/record refunds.
- View sales reports.
- View worker commission/tip reports.
- View date/time range reports.
- Print receipts.
- Configure Clover/printer settings.

### Worker

Worker can:

- View own turn status.
- View own active service.
- View own appointments.
- Add/delete appointments for self.
- View own service totals, tips, commission, and estimated pay.

Worker cannot:

- Checkout customer.
- View all-store sales.
- View other workers' private earnings.
- Process refunds.
- Change service prices.
- Edit other workers' appointments.

### Customer

Customer can:

- Book appointment.
- Check in.
- View own appointment/check-in status.
- Pay when enabled.
- Receive receipt by print now, SMS/email later.

## Service catalog

There is no inventory. The products are salon services.

Required fields:

- Service category.
- Service name.
- Description.
- Price.
- Estimated duration.
- Active/inactive.
- Sort order.

Service price must be snapshotted on sale items so old receipts/reports do not change when service price changes later.

## Check-in queue

Customers can check in as walk-in or appointment customer.

Check-in statuses:

- Waiting.
- Assigned.
- In service.
- Ready for checkout.
- Paid.
- Cancelled.
- No-show.

## Turn tracking

Owner has flexible control. The POS suggests workers but does not force assignment.

Worker status values:

- Available.
- In service.
- On break.
- Off today.
- Appointment only.

Turn lifecycle:

- Assigned.
- In service.
- Completed.
- Skipped.
- Cancelled.

Rules:

- Workers who are not clocked into the current open salon session, or who have clocked out of it, are not available for turn assignment or suggestions.
- Checkout can still attribute sale items, commissions, and tips to an existing worker without checking current availability.
- Turn count increases when service starts.
- Assignment alone does not increase turn count.
- POS should show each worker's turns taken today.
- POS should show if a worker is currently giving service.
- POS should show current customer, service start time, estimated duration, tips today, sales today, and worker earnings today.

Suggested ranking:

1. Available workers first.
2. Lowest turns taken today.
3. Longest time since last completed turn.
4. Lowest service sales today.
5. Not on break/off today.

Owner can override suggestion at any time.

## Worker pay

Worker pay is commission-based.

Rules:

- Each worker has a fixed commission rate.
- Commission rate can differ per worker.
- Worker keeps 100% of tips.
- Commission is calculated from service amount after discount.
- Commission rate must be snapshotted on each sale item.

Formula:

```text
final_service_amount = service_price - discount_amount
worker_commission_amount = final_service_amount * commission_rate_snapshot
worker_total_pay = worker_commission_amount + tip_amount
business_amount = final_service_amount - worker_commission_amount
```

## Checkout

Payment methods:

- Clover card terminal.
- Cash.
- Gift card.
- Split payment.

Checkout supports:

- Multiple services.
- Multiple workers on one sale.
- One-time custom checkout services with owner-entered name and price; these are temporary sale items and are not added to the service catalog.
- Discount per sale or sale item.
- Tips must not be determined or prefilled when sale items are added; Clover/payment-terminal tip flow determines any card tip after the sale is sent for payment. When Clover returns a card tip, Owner POS prompts the owner to allocate it either evenly between workers or by percentage of discounted service amount. If split evenly between workers, each worker's share is automatically distributed across that worker's services by percentage of discounted service amount. Approved allocated tips are attributed to sale items for worker/service reporting.
- Printed receipt.
- Refund tracking.
- Date/time reporting.

Split payment example:

```text
Total: $120
Gift card: $20
Cash: $40
Clover card: $60
```

Only the card portion goes to Clover.

## Receipts

Version 1 requires printed receipts.

Receipt must include:

- Salon name/address/phone.
- Receipt number.
- Date/time.
- Services.
- Worker per service.
- Subtotal.
- Discount.
- Tip.
- Total.
- Payment method breakdown.
- Clover payment reference/auth code when available.

Future path:

- SMS receipt.
- Email receipt.

## Reports

Reports must support date and timestamp range filters.

Required reports:

- Sales report.
- Worker earnings report.
- Worker turn report.
- Refund report.
- Discount report.
- Payment method report.
- End-of-day summary.

Important totals:

- Gross service sales.
- Discounts.
- Refunds.
- Net service sales.
- Tips.
- Worker commission payout.
- Worker tips payout.
- Business service share.
- Cash total.
- Card total.
- Gift card total.

## Offline requirements

If internet is down but local network is working:

- Owner POS works.
- Worker PWA works on store Wi-Fi.
- Check-in works.
- Cash checkout works.
- Local reports work.
- Receipt printing works.
- SMS/email receipt queues for later.
- Cloud appointment sync resumes later.

Clover card processing depends on Clover's supported local/offline behavior and configuration.

## App distribution

Use PWA for worker app so workers do not need App Store installation.

Worker opens the worker web app on iPhone and uses "Add to Home Screen".
