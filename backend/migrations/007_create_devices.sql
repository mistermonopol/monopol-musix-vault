CREATE TABLE user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'unknown',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT user_devices_name_valid CHECK (btrim(name) <> '' AND length(name) <= 200),
  CONSTRAINT user_devices_kind_valid CHECK (btrim(kind) <> '' AND length(kind) <= 50)
);

CREATE INDEX user_devices_user_idx ON user_devices(user_id, created_at DESC);

ALTER TABLE refresh_sessions
  ADD COLUMN device_id uuid REFERENCES user_devices(id) ON DELETE SET NULL;

CREATE INDEX refresh_sessions_device_id_idx ON refresh_sessions(device_id);
