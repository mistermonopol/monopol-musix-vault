import { z } from 'zod';

const environmentSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }

  return result.data;
}
