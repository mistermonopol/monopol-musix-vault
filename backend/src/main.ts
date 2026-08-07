import { buildApp } from './app.js';
import { loadConfig } from './infrastructure/config.js';

async function start(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await buildApp({ config });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutdown requested');
    await app.close();
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
