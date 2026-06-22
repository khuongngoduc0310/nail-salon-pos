CREATE TABLE worker_session_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id),
  notes TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_worker_session_checkins_session_worker
  ON worker_session_checkins(session_id, worker_id);

CREATE INDEX idx_worker_session_checkins_session_checked_in_at
  ON worker_session_checkins(session_id, checked_in_at);
