CREATE TABLE track_artwork (
  track_id uuid PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  mime_type text NOT NULL,
  data bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT track_artwork_mime_type_valid CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT track_artwork_size_valid CHECK (octet_length(data) BETWEEN 1 AND 5242880)
);
