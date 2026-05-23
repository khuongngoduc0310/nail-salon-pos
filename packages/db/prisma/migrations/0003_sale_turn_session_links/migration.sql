ALTER TABLE sales
ADD COLUMN session_id UUID REFERENCES work_sessions(id);

ALTER TABLE turns
ADD COLUMN session_id UUID REFERENCES work_sessions(id);

CREATE INDEX idx_sales_session_id ON sales(session_id);
CREATE INDEX idx_turns_session_id ON turns(session_id);
