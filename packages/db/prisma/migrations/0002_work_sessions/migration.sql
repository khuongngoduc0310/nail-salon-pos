CREATE TYPE work_session_status AS ENUM ('open', 'closed');

CREATE TABLE work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date TIMESTAMPTZ NOT NULL,
  status work_session_status NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opened_by_user_id UUID REFERENCES users(id),
  closed_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checkins
ADD COLUMN session_id UUID REFERENCES work_sessions(id);

CREATE INDEX idx_checkins_session_id ON checkins(session_id);
CREATE INDEX idx_work_sessions_status_date ON work_sessions(status, business_date);
CREATE UNIQUE INDEX idx_work_sessions_single_open ON work_sessions(status) WHERE status = 'open';
