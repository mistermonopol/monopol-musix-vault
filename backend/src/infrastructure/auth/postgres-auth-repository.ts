import type { Sql } from 'postgres';

import type { AuthRepository } from '../../application/auth-ports.js';
import type { PublicUser, User, UserRole } from '../../domain/user.js';

interface UserRow {
  readonly created_at: Date;
  readonly email: string;
  readonly id: string;
  readonly password_hash: string;
  readonly role: UserRole;
}

function mapUser(row: UserRow): User {
  return {
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    passwordHash: row.password_hash,
    role: row.role,
  };
}

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly sql: Sql) {}

  public bootstrapAdmin(email: string, passwordHash: string): Promise<User | null> {
    return this.sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(917324601)`;
      const [countRow] = await transaction<{ count: number }[]>`
        SELECT count(*)::int AS count FROM users
      `;
      if (countRow === undefined || countRow.count !== 0) return null;
      const [row] = await transaction<UserRow[]>`
        INSERT INTO users (email, password_hash, role)
        VALUES (${email}, ${passwordHash}, 'admin')
        RETURNING id, email::text, password_hash, role, created_at
      `;
      return row === undefined ? null : mapUser(row);
    });
  }

  public async createRefreshSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.sql`
      INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAt})
    `;
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    const [row] = await this.sql<UserRow[]>`
      SELECT id, email::text, password_hash, role, created_at
      FROM users WHERE email = ${email}
    `;
    return row === undefined ? null : mapUser(row);
  }

  public async findUserById(id: string): Promise<PublicUser | null> {
    const [row] = await this.sql<UserRow[]>`
      SELECT id, email::text, password_hash, role, created_at
      FROM users WHERE id = ${id}
    `;
    if (row === undefined) return null;
    const { passwordHash: _passwordHash, ...user } = mapUser(row);
    return user;
  }

  public async revokeRefreshSession(tokenHash: string): Promise<void> {
    await this.sql`
      UPDATE refresh_sessions SET revoked_at = now()
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    `;
  }

  public rotateRefreshSession(
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
  ): Promise<User | null> {
    return this.sql.begin(async (transaction) => {
      const [row] = await transaction<UserRow[]>`
        SELECT u.id, u.email::text, u.password_hash, u.role, u.created_at
        FROM refresh_sessions r
        JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = ${currentTokenHash}
          AND r.revoked_at IS NULL
          AND r.expires_at > now()
        FOR UPDATE OF r
      `;
      if (row === undefined) return null;
      await transaction`
        UPDATE refresh_sessions SET revoked_at = now()
        WHERE token_hash = ${currentTokenHash}
      `;
      await transaction`
        INSERT INTO refresh_sessions (user_id, token_hash, expires_at)
        VALUES (${row.id}, ${nextTokenHash}, ${nextExpiresAt})
      `;
      return mapUser(row);
    });
  }
}
