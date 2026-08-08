import { z } from 'zod';

const environmentSchema = z.object({
  API_ACCESS_CODE: z.string().min(16),
  ARTWORK_LOOKUP_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  ARTWORK_LOOKUP_ENABLED: z.stringbool().default(false),
  ARTWORK_LOOKUP_REQUEST_INTERVAL_MS: z.coerce.number().int().min(1100).max(60_000).default(1100),
  ARTWORK_LOOKUP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
  MUSICBRAINZ_USER_AGENT: z.string().min(10).default('MonopolMusixVault/0.4.0 (https://vault.monopol-ai.de; derdildi@gmail.com)'),
  AUTH_ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  AUTH_REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AUTH_SECRET: z.string().min(32),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(100).default(10),
  DB_NAME: z.string().min(1).default('musix_vault'),
  DB_PASSWORD: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(5432),
  DB_SSL: z.stringbool().default(false),
  DB_USER: z.string().min(1).default('musix_vault'),
  HOST: z.string().min(1).default('0.0.0.0'),
  LIBRARY_PATH: z.string().min(1).default('/music'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  OBSIDIAN_PATH: z.string().min(1).default('/brain'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export interface AuthConfig {
  readonly accessTokenMinutes: number;
  readonly refreshTokenDays: number;
  readonly secret: string;
}

export interface DatabaseConfig {
  readonly database: string;
  readonly host: string;
  readonly maxConnections: number;
  readonly password: string;
  readonly port: number;
  readonly ssl: boolean;
  readonly user: string;
}

export interface ArtworkLookupConfig {
  readonly batchSize: number;
  readonly enabled: boolean;
  readonly requestIntervalMs: number;
  readonly timeoutMs: number;
  readonly userAgent: string;
}

export interface AppConfig {
  readonly accessCode: string;
  readonly artworkLookup: ArtworkLookupConfig;
  readonly auth: AuthConfig;
  readonly database: DatabaseConfig;
  readonly HOST: string;
  readonly LIBRARY_PATH: string;
  readonly LOG_LEVEL: z.infer<typeof environmentSchema>['LOG_LEVEL'];
  readonly NODE_ENV: z.infer<typeof environmentSchema>['NODE_ENV'];
  readonly OBSIDIAN_PATH: string;
  readonly PORT: number;
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }

  return {
    accessCode: result.data.API_ACCESS_CODE,
    artworkLookup: {
      batchSize: result.data.ARTWORK_LOOKUP_BATCH_SIZE,
      enabled: result.data.ARTWORK_LOOKUP_ENABLED,
      requestIntervalMs: result.data.ARTWORK_LOOKUP_REQUEST_INTERVAL_MS,
      timeoutMs: result.data.ARTWORK_LOOKUP_TIMEOUT_MS,
      userAgent: result.data.MUSICBRAINZ_USER_AGENT,
    },
    auth: {
      accessTokenMinutes: result.data.AUTH_ACCESS_TOKEN_MINUTES,
      refreshTokenDays: result.data.AUTH_REFRESH_TOKEN_DAYS,
      secret: result.data.AUTH_SECRET,
    },
    database: {
      database: result.data.DB_NAME,
      host: result.data.DB_HOST,
      maxConnections: result.data.DB_MAX_CONNECTIONS,
      password: result.data.DB_PASSWORD,
      port: result.data.DB_PORT,
      ssl: result.data.DB_SSL,
      user: result.data.DB_USER,
    },
    HOST: result.data.HOST,
    LIBRARY_PATH: result.data.LIBRARY_PATH,
    LOG_LEVEL: result.data.LOG_LEVEL,
    NODE_ENV: result.data.NODE_ENV,
    OBSIDIAN_PATH: result.data.OBSIDIAN_PATH,
    PORT: result.data.PORT,
  };
}
