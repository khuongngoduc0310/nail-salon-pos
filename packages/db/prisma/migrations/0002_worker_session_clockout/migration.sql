DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('open', 'closed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash_cents INTEGER NOT NULL DEFAULT 0,
  closing_cash_cents INTEGER,
  status session_status NOT NULL DEFAULT 'open',
  opened_by_user_id UUID,
  closed_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE turns
  ADD COLUMN IF NOT EXISTS session_id UUID;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE TABLE IF NOT EXISTS worker_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ,
  UNIQUE (worker_id, session_id)
);

ALTER TABLE worker_sessions
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turns_session_id_fkey'
  ) THEN
    ALTER TABLE turns
      ADD CONSTRAINT turns_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_session_id_fkey'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS sessions_status_idx ON sessions(status);
CREATE INDEX IF NOT EXISTS turns_session_id_idx ON turns(session_id);
CREATE INDEX IF NOT EXISTS sales_session_id_idx ON sales(session_id);
CREATE INDEX IF NOT EXISTS worker_sessions_session_id_idx ON worker_sessions(session_id);
