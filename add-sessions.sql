-- Add sessions table and link to existing tables

CREATE TYPE session_status AS ENUM ('open', 'closed');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash_cents INTEGER NOT NULL DEFAULT 0,
  closing_cash_cents INTEGER,
  status session_status NOT NULL DEFAULT 'open',
  opened_by_user_id UUID REFERENCES users(id),
  closed_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link sales and turns to sessions
ALTER TABLE sales ADD COLUMN session_id UUID REFERENCES sessions(id);
ALTER TABLE turns ADD COLUMN session_id UUID REFERENCES sessions(id);

CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sales_session ON sales(session_id);
CREATE INDEX idx_turns_session ON turns(session_id);