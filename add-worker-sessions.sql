-- Add worker_sessions table for worker check-in tracking

CREATE TABLE worker_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(worker_id, session_id)
);

CREATE INDEX idx_worker_sessions_session ON worker_sessions(session_id);