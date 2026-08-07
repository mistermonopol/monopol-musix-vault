import { buildApp } from './app.js';
import { loadConfig } from './infrastructure/config.js';
import { runMigrations } from './infrastructure/database/migrate.js';
import { PostgresDatabase } from './infrastructure/database/postgres-database.js';

async function start(): Promise<void> {
  const config = loadConfig(process.env);
  const database = await PostgresDatabase.connect(config.database);

  try {
    await runMigrations(database.client, new URL('../migrations/', import.meta.url));
  } catch (error: unknown) {
    await database.close();
    throw error;
  }

  const app = await buildApp({ config, databaseHealth: database });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutdown requested');
    await app.close();
    await database.close();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.HOST, port: config.PORT });
}

start().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({ detail, level: 'fatal', message: 'Backend startup failed' })}\n`,
  );
  process.exitCode = 1;
});
