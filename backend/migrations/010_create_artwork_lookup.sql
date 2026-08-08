ALTER TABLE track_artwork
  ADD COLUMN source text NOT NULL DEFAULT 'embedded',
  ADD COLUMN musicbrainz_release_group_id uuid,
  ADD COLUMN match_score integer,
  ADD COLUMN provenance jsonb;

ALTER TABLE track_artwork
  ADD CONSTRAINT track_artwork_source_valid CHECK (source IN ('embedded', 'musicbrainz')),
  ADD CONSTRAINT track_artwork_match_score_valid CHECK (match_score IS NULL OR match_score BETWEEN 0 AND 100),
  ADD CONSTRAINT track_artwork_musicbrainz_metadata_valid CHECK (
    (source = 'embedded' AND musicbrainz_release_group_id IS NULL AND match_score IS NULL AND provenance IS NULL)
    OR
    (source = 'musicbrainz' AND musicbrainz_release_group_id IS NOT NULL AND match_score IS NOT NULL AND provenance IS NOT NULL)
  );

CREATE TABLE artwork_lookup_attempts (
  album_id uuid PRIMARY KEY REFERENCES albums(id) ON DELETE CASCADE,
  status text NOT NULL,
  musicbrainz_release_group_id uuid,
  match_score integer,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  detail text,
  CONSTRAINT artwork_lookup_attempt_status_valid CHECK (status IN ('success', 'no_match', 'no_cover', 'failed')),
  CONSTRAINT artwork_lookup_attempt_score_valid CHECK (match_score IS NULL OR match_score BETWEEN 0 AND 100),
  CONSTRAINT artwork_lookup_attempt_metadata_valid CHECK (
    (status IN ('success', 'no_cover') AND musicbrainz_release_group_id IS NOT NULL AND match_score IS NOT NULL)
    OR status IN ('no_match', 'failed')
  )
);

CREATE INDEX artwork_lookup_attempts_attempted_at_idx ON artwork_lookup_attempts (attempted_at);
