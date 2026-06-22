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
<<<<<<< HEAD
- Tips must not be determined or prefilled when sale items are added; Clover/payment-terminal tip flow determines any card tip after the sale is sent for payment. When Clover returns a card tip, Owner POS prompts the owner to allocate it either evenly between workers or by percentage of discounted service amount. If split evenly between workers, each worker's share is automatically distributed across that worker's services by percentage of discounted service amount. Approved allocated tips are attributed to sale items for worker/service reporting.
=======
- Tip per worker/service (distributed after card payment).
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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

### Owner POS checkout UI rules

The Owner POS checkout screen is designed for touch-screen use (Windows or iPad). No dropdown menus are used in the checkout flow.

Order-building flow:

1. Owner taps a ready-for-checkout customer to open a draft sale.
2. Owner taps a worker first, then taps a service to add that service line item to the order. If no worker is selected, the POS shows a notification.
3. Owner can add multiple services for multiple workers in the same order.
4. To reassign a worker on an existing line item, owner taps the item then taps the new worker. Only that one line item changes.
5. Owner taps "Proceed to payment" when the order is complete.

Payment flow:

1. Owner sees balance due and three payment buttons: Cash, Gift Card, and Card.
2. Tapping Cash or Gift Card opens an on-screen numpad. Cash and gift card payments have no tip; they reduce the balance due.
3. Tapping Card sends the remaining balance to the Clover Mini. The customer sees the total on the Clover screen and enters their tip directly on the terminal.
4. When the card is approved, the Clover Mini returns the approved tip amount.
5. The POS immediately shows a tip distribution screen.

### Tip distribution rules

- Tips are only collected via the Clover Mini card terminal. Cash and gift card payments carry no tip.
- After card approval, the POS auto-distributes the terminal tip across workers proportional to each worker's share of the sale subtotal (after discounts).
- Workers whose services have a $0 net price receive $0 tip by default.
- The owner can tap any worker row to adjust that worker's tip amount using an on-screen numpad. The remaining tip is immediately rebalanced across all other workers proportionally by their service amounts. The total always remains locked to the amount the terminal approved.
- Once the owner confirms the tip distribution, each sale item's `tipCents` is updated and the sale total is recalculated.
- If tip adjustment leaves a rounding remainder, it is assigned to the last worker in the list.
- If a sale is paid entirely by cash or gift card, no tip distribution step occurs.

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
