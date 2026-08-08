CREATE TABLE playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playlists_name_valid CHECK (btrim(name) <> '' AND length(name) <= 200),
  CONSTRAINT playlists_description_valid CHECK (length(description) <= 2000)
);

CREATE INDEX playlists_user_updated_idx ON playlists(user_id, updated_at DESC);

CREATE TABLE playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playlist_items_position_valid CHECK (position >= 0),
  UNIQUE (playlist_id, position)
);

CREATE INDEX playlist_items_track_id_idx ON playlist_items(track_id);
