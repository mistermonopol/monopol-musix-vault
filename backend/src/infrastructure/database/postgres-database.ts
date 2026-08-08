import postgres, { type Sql } from 'postgres';

import type { DatabaseHealth } from '../../application/database-health.js';
import type { DatabaseConfig } from '../config.js';

export class PostgresDatabase implements DatabaseHealth {
  private constructor(private readonly sql: Sql) {}

  public static async connect(config: DatabaseConfig): Promise<PostgresDatabase> {
    const sql = postgres({
      connect_timeout: 5,
      database: config.database,
      host: config.host,
      idle_timeout: 20,
      max: config.maxConnections,
      max_lifetime: 60 * 30,
      password: config.password,
      port: config.port,
      ssl: config.ssl ? 'require' : false,
      user: config.user,
    });

    const database = new PostgresDatabase(sql);

    try {
      await sql`SELECT 1`;
      return database;
    } catch (error: unknown) {
      await sql.end({ timeout: 1 });
      throw error;
    }
  }

  public get client(): Sql {
    return this.sql;
  }

  public async isReady(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
