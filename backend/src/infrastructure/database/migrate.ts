import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

import type { Sql } from 'postgres';

interface AppliedMigration {
  readonly checksum: string;
  readonly name: string;
}

const migrationNamePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const migrationLockId = 1_829_734_211;

export async function runMigrations(sql: Sql, directory: URL): Promise<void> {
  const names = (await readdir(directory))
    .filter((name) => migrationNamePattern.test(name))
    .sort();

  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(${migrationLockId})`;
    await transaction`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const applied = await transaction<AppliedMigration[]>`
      SELECT name, checksum
      FROM schema_migrations
      ORDER BY name
    `;
    const appliedByName = new Map(applied.map((migration) => [migration.name, migration]));

    for (const name of names) {
      const contents = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(contents).digest('hex');
      const previous = appliedByName.get(name);

      if (previous !== undefined) {
        if (previous.checksum !== checksum) {
          throw new Error(`Applied migration has changed: ${name}`);
        }
        continue;
      }

      await transaction.unsafe(contents);
      await transaction`
        INSERT INTO schema_migrations (name, checksum)
        VALUES (${name}, ${checksum})
      `;
    }
  });
}
