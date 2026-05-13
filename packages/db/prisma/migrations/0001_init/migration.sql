CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Nail Salon POS v1 schema draft
-- Target database: PostgreSQL

CREATE TYPE user_role AS ENUM ('owner', 'worker', 'customer');
CREATE TYPE worker_status AS ENUM ('available', 'in_service', 'on_break', 'off_today', 'appointment_only');
CREATE TYPE checkin_status AS ENUM ('waiting', 'assigned', 'in_service', 'ready_for_checkout', 'paid', 'cancelled', 'no_show');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show');
CREATE TYPE turn_status AS ENUM ('assigned', 'in_service', 'completed', 'skipped', 'cancelled');
CREATE TYPE turn_type AS ENUM ('walk_in', 'appointment', 'requested_worker', 'manual');
CREATE TYPE sale_status AS ENUM ('draft', 'open', 'partially_paid', 'paid', 'refunded', 'voided');
CREATE TYPE sale_item_status AS ENUM ('active', 'refunded', 'voided');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'gift_card', 'other');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'declined', 'cancelled', 'failed', 'refunded');
CREATE TYPE discount_type AS ENUM ('amount', 'percent');
CREATE TYPE gift_card_status AS ENUM ('active', 'disabled', 'expired');
CREATE TYPE gift_card_tx_type AS ENUM ('issue', 'redeem', 'refund', 'adjustment');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  role user_role NOT NULL,
  password_hash TEXT,
  pin_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  display_name TEXT NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  current_status worker_status NOT NULL DEFAULT 'available',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES service_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  worker_id UUID REFERENCES workers(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  price_cents_at_booking INTEGER NOT NULL CHECK (price_cents_at_booking >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  appointment_id UUID REFERENCES appointments(id),
  status checkin_status NOT NULL DEFAULT 'waiting',
  requested_worker_id UUID REFERENCES workers(id),
  notes TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  customer_id UUID REFERENCES customers(id),
  checkin_id UUID REFERENCES checkins(id),
  appointment_id UUID REFERENCES appointments(id),
  sale_id UUID,
  turn_type turn_type NOT NULL DEFAULT 'manual',
  status turn_status NOT NULL DEFAULT 'assigned',
  assigned_by_user_id UUID REFERENCES users(id),
  suggested_worker_id UUID REFERENCES workers(id),
  owner_override_reason TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  skipped_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  appointment_id UUID REFERENCES appointments(id),
  checkin_id UUID REFERENCES checkins(id),
  receipt_number TEXT UNIQUE,
  status sale_status NOT NULL DEFAULT 'draft',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  tip_total_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE turns ADD CONSTRAINT turns_sale_fk FOREIGN KEY (sale_id) REFERENCES sales(id);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  service_name_snapshot TEXT NOT NULL,
  category_name_snapshot TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  final_service_cents INTEGER NOT NULL CHECK (final_service_cents >= 0),
  commission_rate_snapshot NUMERIC(5,4) NOT NULL CHECK (commission_rate_snapshot >= 0 AND commission_rate_snapshot <= 1),
  worker_commission_cents INTEGER NOT NULL DEFAULT 0,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  worker_total_cents INTEGER NOT NULL DEFAULT 0,
  business_cents INTEGER NOT NULL DEFAULT 0,
  status sale_item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method payment_method NOT NULL,
  provider TEXT,
  provider_payment_id TEXT,
  provider_order_id TEXT,
  idempotency_key TEXT UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  tip_cents INTEGER NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  status payment_status NOT NULL DEFAULT 'pending',
  card_brand TEXT,
  card_last4 TEXT,
  auth_code TEXT,
  raw_provider_reference JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  payment_id UUID REFERENCES payments(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT,
  approved_by_user_id UUID REFERENCES users(id),
  provider_refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE CASCADE,
  type discount_type NOT NULL,
  amount_cents INTEGER,
  percent NUMERIC(5,4),
  reason TEXT,
  approved_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  status gift_card_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id),
  sale_id UUID REFERENCES sales(id),
  amount_cents INTEGER NOT NULL,
  transaction_type gift_card_tx_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  print_status TEXT NOT NULL DEFAULT 'not_printed',
  sms_status TEXT NOT NULL DEFAULT 'not_sent',
  email_status TEXT NOT NULL DEFAULT 'not_sent',
  receipt_data_json JSONB NOT NULL,
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkins_status_time ON checkins(status, checked_in_at);
CREATE INDEX idx_turns_worker_status ON turns(worker_id, status);
CREATE INDEX idx_turns_started_at ON turns(started_at);
CREATE INDEX idx_sales_completed_at ON sales(completed_at);
CREATE INDEX idx_payments_sale_id ON payments(sale_id);
CREATE INDEX idx_sale_items_worker_id ON sale_items(worker_id);
CREATE INDEX idx_appointments_worker_time ON appointments(worker_id, start_time, end_time);
