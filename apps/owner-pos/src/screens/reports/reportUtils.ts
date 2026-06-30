export type ReportKey = "sales" | "workers" | "turns" | "payments" | "refunds" | "discounts" | "eod";
export type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getReportPresetRange(preset: DatePreset) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (preset === "yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (preset === "week") {
    start.setDate(today.getDate() - today.getDay());
  } else if (preset === "month") {
    start.setDate(1);
  }

  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

export function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export function readNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export const reportTypeOptions: { key: ReportKey; label: string; icon: string; description: string }[] = [
  { key: "sales", label: "Sales", icon: "Sales", description: "Tickets, services, tips, and collected totals" },
  { key: "workers", label: "Workers", icon: "Staff", description: "Commission, tips, and total worker pay" },
  { key: "turns", label: "Turns", icon: "Turns", description: "Turn detail, completion, and duration" },
  { key: "payments", label: "Payments", icon: "Pay", description: "Approved payments by method and provider" },
  { key: "refunds", label: "Refunds", icon: "Back", description: "Refund count and refund totals" },
  { key: "discounts", label: "Discounts", icon: "Deal", description: "Discount usage by ticket and service" },
  { key: "eod", label: "End of Day", icon: "EOD", description: "Closeout totals and reconciliation" },
];

export const datePresetOptions: { key: DatePreset; label: string; description: string }[] = [
  { key: "today", label: "Today", description: "Current business day" },
  { key: "yesterday", label: "Yesterday", description: "Previous business day" },
  { key: "week", label: "This week", description: "Sunday through today" },
  { key: "month", label: "This month", description: "Month-to-date" },
  { key: "custom", label: "Custom range", description: "Choose start and end dates" },
];
