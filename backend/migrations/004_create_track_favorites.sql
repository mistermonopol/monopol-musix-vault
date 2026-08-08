CREATE TABLE user_track_favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE INDEX user_track_favorites_track_id_idx
  ON user_track_favorites(track_id);
