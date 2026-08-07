import { buildApp } from './app.js';
import { AuthService } from './application/auth-service.js';
import { ArgonPasswordHasher } from './infrastructure/auth/argon-password-hasher.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token-service.js';
import { PostgresAuthRepository } from './infrastructure/auth/postgres-auth-repository.js';
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

  const authRepository = new PostgresAuthRepository(database.client);
  const tokenService = new JwtTokenService(config.auth);
  const authService = new AuthService(
    authRepository,
    new ArgonPasswordHasher(),
    tokenService,
  );
  const app = await buildApp({
    authRepository,
    authService,
    config,
    databaseHealth: database,
    tokenService,
  });

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
