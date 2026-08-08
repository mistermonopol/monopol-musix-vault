CREATE TABLE listening_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  position_seconds double precision,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listening_events_type_valid CHECK (event_type IN ('started', 'progress', 'paused', 'completed')),
  CONSTRAINT listening_events_position_valid CHECK (position_seconds IS NULL OR position_seconds >= 0)
);

CREATE INDEX listening_events_user_recent_idx
  ON listening_events(user_id, occurred_at DESC);

CREATE TABLE listening_positions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position_seconds double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id),
  CONSTRAINT listening_positions_position_valid CHECK (position_seconds >= 0)
);
