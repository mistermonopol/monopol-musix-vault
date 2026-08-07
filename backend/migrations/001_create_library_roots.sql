CREATE TABLE library_roots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_roots_path_not_empty CHECK (btrim(path) <> '')
);

COMMENT ON TABLE library_roots IS
  'User-configured filesystem roots scanned for music files.';
COMMENT ON COLUMN library_roots.path IS
  'Path as visible inside the backend container.';
