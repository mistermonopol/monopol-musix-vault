CREATE TABLE artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artists_name_not_empty CHECK (btrim(name) <> '')
);

CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  normalized_title text NOT NULL,
  album_artist_key text NOT NULL DEFAULT '',
  year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (normalized_title, album_artist_key),
  CONSTRAINT albums_title_not_empty CHECK (btrim(title) <> ''),
  CONSTRAINT albums_year_valid CHECK (year IS NULL OR year BETWEEN 1000 AND 9999)
);

CREATE TABLE album_artists (
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  PRIMARY KEY (album_id, artist_id),
  UNIQUE (album_id, position)
);

CREATE TABLE genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  CONSTRAINT genres_name_not_empty CHECK (btrim(name) <> '')
);

CREATE TABLE scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  discovered_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  CONSTRAINT scan_runs_status_valid CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE UNIQUE INDEX scan_runs_single_running_idx
  ON scan_runs ((status)) WHERE status = 'running';

CREATE TABLE tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_root_id uuid NOT NULL REFERENCES library_roots(id) ON DELETE RESTRICT,
  relative_path text NOT NULL,
  file_size bigint NOT NULL,
  modified_at timestamptz NOT NULL,
  title text NOT NULL,
  album_id uuid REFERENCES albums(id) ON DELETE SET NULL,
  year integer,
  track_number integer,
  track_total integer,
  disc_number integer,
  disc_total integer,
  duration_seconds double precision,
  codec text,
  container text,
  bitrate integer,
  sample_rate integer,
  available boolean NOT NULL DEFAULT true,
  last_seen_scan_id uuid REFERENCES scan_runs(id) ON DELETE SET NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_root_id, relative_path),
  CONSTRAINT tracks_relative_path_not_empty CHECK (btrim(relative_path) <> ''),
  CONSTRAINT tracks_title_not_empty CHECK (btrim(title) <> ''),
  CONSTRAINT tracks_file_size_valid CHECK (file_size >= 0),
  CONSTRAINT tracks_year_valid CHECK (year IS NULL OR year BETWEEN 1000 AND 9999)
);

CREATE INDEX tracks_album_id_idx ON tracks(album_id);
CREATE INDEX tracks_available_idx ON tracks(available);
CREATE INDEX tracks_last_seen_scan_id_idx ON tracks(last_seen_scan_id);

CREATE TABLE track_artists (
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  PRIMARY KEY (track_id, artist_id),
  UNIQUE (track_id, position)
);

CREATE TABLE track_genres (
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
  PRIMARY KEY (track_id, genre_id)
);
