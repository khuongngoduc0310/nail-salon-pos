import React, {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useState,
} from "react";

/* ══════════════════════════════════════════
   Button
   ══════════════════════════════════════════ */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? "btn--full" : "",
    loading ? "btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="btn__spinner" aria-hidden /> : null}
      <span className={loading ? "btn__label--hidden" : ""}>{children}</span>
    </button>
  );
}

/* ══════════════════════════════════════════
   Card
   ══════════════════════════════════════════ */

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "md" | "lg";
  onClick?: () => void;
}

export function Card({ children, className = "", padding = "md", onClick }: CardProps) {
  const cls = ["card", `card--${padding}`, onClick ? "card--clickable" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <article className={cls} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </article>
  );
}

/* ══════════════════════════════════════════
   Badge
   ══════════════════════════════════════════ */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return <span className={`badge badge--${variant} ${className}`}>{children}</span>;
}

/* ══════════════════════════════════════════
   StatusPill
   ══════════════════════════════════════════ */

const statusColorMap: Record<string, BadgeVariant> = {
  available: "success",
  in_service: "info",
  on_break: "warning",
  off_today: "danger",
  appointment_only: "default",
  waiting: "warning",
  assigned: "info",
  ready_for_checkout: "success",
  paid: "success",
  cancelled: "danger",
  no_show: "danger",
  completed: "success",
  skipped: "warning",
  active: "success",
  inactive: "danger",
  pending: "warning",
  approved: "success",
  declined: "danger",
  scheduled: "info",
  confirmed: "info",
  checked_in: "info",
};

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
  const variant = statusColorMap[status] ?? "default";
  const label = status.replaceAll("_", " ");
  return <Badge variant={variant} className={`status-pill ${className}`}>{label}</Badge>;
}

/* ══════════════════════════════════════════
   MoneyDisplay
   ══════════════════════════════════════════ */

interface MoneyDisplayProps {
  cents: number;
  className?: string;
  sign?: boolean;
}

export function MoneyDisplay({ cents, className = "", sign = false }: MoneyDisplayProps) {
  const absCents = Math.abs(cents);
  const dollars = absCents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);

  const display = sign && cents < 0 ? `−${formatted}` : formatted;
  return <span className={`money ${className}`}>{display}</span>;
}

/* ══════════════════════════════════════════
   Input
   ══════════════════════════════════════════ */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label" htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={`field__input ${error ? "field__input--error" : ""}`} {...rest} />
      {error && <p className="field__error">{error}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════
   Select
   ══════════════════════════════════════════ */

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, options, placeholder, className = "", id, ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label" htmlFor={selectId}>{label}</label>}
      <select id={selectId} className="field__select" {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ══════════════════════════════════════════
   Modal
   ══════════════════════════════════════════ */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, className = "" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   BottomNav
   ══════════════════════════════════════════ */

interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}

interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.label}
          className={`bottom-nav__item ${item.active ? "bottom-nav__item--active" : ""} ${item.label === "Checkout" ? "bottom-nav__item--checkout" : ""}`}
          onClick={item.onClick}
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ══════════════════════════════════════════
   EmptyState
   ══════════════════════════════════════════ */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "📋", title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════
   Tabs
   ══════════════════════════════════════════ */

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.key} className={`tabs__tab ${tab.key === activeKey ? "tabs__tab--active" : ""}`} role="tab" aria-selected={tab.key === activeKey} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   AmountInput — for dollar amounts
   ══════════════════════════════════════════ */

interface AmountInputProps {
  label: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
  className?: string;
}

export function AmountInput({ label, valueCents, onChangeCents, className = "" }: AmountInputProps) {
  const [text, setText] = useState(() => (valueCents === 0 ? "" : (valueCents / 100).toFixed(2)));

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const trimmed = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setText(trimmed);
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num >= 0) {
      onChangeCents(Math.round(num * 100));
    } else if (trimmed === "" || trimmed === ".") {
      onChangeCents(0);
    }
  };

  return (
    <div className={`field ${className}`}>
      <label className="field__label">{label}</label>
      <div className="amount-input">
        <span className="amount-input__prefix">$</span>
        <input className="field__input amount-input__field" type="text" inputMode="decimal" value={text} onChange={(e) => handleChange(e.target.value)} placeholder="0.00" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   StatCard — KPI display
   ══════════════════════════════════════════ */

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, sub, className = "" }: StatCardProps) {
  return (
    <div className={`stat-card ${className}`}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </div>
  );
}