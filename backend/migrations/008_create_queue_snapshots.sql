CREATE TABLE queue_snapshots (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_index integer,
  position_seconds double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id),
  CONSTRAINT queue_items_array CHECK (jsonb_typeof(items) = 'array'),
  CONSTRAINT queue_items_bounded CHECK (jsonb_array_length(items) <= 500),
  CONSTRAINT queue_index_valid CHECK (current_index IS NULL OR current_index >= 0),
  CONSTRAINT queue_position_valid CHECK (position_seconds >= 0)
);
