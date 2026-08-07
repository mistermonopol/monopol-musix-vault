import { describe, expect, it } from 'vitest';

import type {
  AccessTokenClaims,
  AuthRepository,
  PasswordHasher,
  TokenService,
} from '../src/application/auth-ports.js';
import { AuthService } from '../src/application/auth-service.js';
import type { PublicUser, User } from '../src/domain/user.js';

class MemoryAuthRepository implements AuthRepository {
  public user: User | null = null;
  public readonly sessions = new Map<string, string>();

  public async bootstrapAdmin(email: string, passwordHash: string): Promise<User | null> {
    if (this.user !== null) return null;
    this.user = {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      email,
      id: 'user-1',
      passwordHash,
      role: 'admin',
    };
    return this.user;
  }

  public async createRefreshSession(userId: string, tokenHash: string): Promise<void> {
    this.sessions.set(tokenHash, userId);
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    return this.user?.email === email ? this.user : null;
  }

  public async findUserById(id: string): Promise<PublicUser | null> {
    if (this.user?.id !== id) return null;
    const { passwordHash: _passwordHash, ...user } = this.user;
    return user;
  }

  public async revokeRefreshSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  public async rotateRefreshSession(
    currentTokenHash: string,
    nextTokenHash: string,
  ): Promise<User | null> {
    if (!this.sessions.has(currentTokenHash) || this.user === null) return null;
    this.sessions.delete(currentTokenHash);
    this.sessions.set(nextTokenHash, this.user.id);
    return this.user;
  }
}

const passwordHasher: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  verify: async (hash, password) => hash === `hashed:${password}`,
};

class DeterministicTokens implements TokenService {
  private sequence = 0;

  public async createAccessToken(user: User): Promise<string> {
    return `access:${user.id}`;
  }

  public createRefreshToken(): { expiresAt: Date; hash: string; token: string } {
    this.sequence += 1;
    const token = `refresh-${this.sequence}`;
    return { expiresAt: new Date('2027-01-01T00:00:00.000Z'), hash: this.hashRefreshToken(token), token };
  }

  public hashRefreshToken(token: string): string {
    return `hash:${token}`;
  }

  public async verifyAccessToken(): Promise<AccessTokenClaims> {
    return { role: 'admin', userId: 'user-1' };
  }
}

describe('AuthService', () => {
  it('bootstraps exactly one administrator without exposing the password hash', async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, passwordHasher, new DeterministicTokens());

    const result = await service.bootstrap('owner@example.com', 'strong-password');

    expect(result.user).toEqual({
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      email: 'owner@example.com',
      id: 'user-1',
      role: 'admin',
    });
    await expect(service.bootstrap('other@example.com', 'strong-password')).rejects.toMatchObject({
      code: 'ALREADY_BOOTSTRAPPED',
      statusCode: 409,
    });
  });

  it('rejects invalid credentials with a generic error', async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, passwordHasher, new DeterministicTokens());
    await service.bootstrap('owner@example.com', 'correct-password');

    await expect(service.login('owner@example.com', 'wrong-password')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, passwordHasher, new DeterministicTokens());
    const initial = await service.bootstrap('owner@example.com', 'correct-password');

    const rotated = await service.refresh(initial.refreshToken);

    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    await expect(service.refresh(initial.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      statusCode: 401,
    });
  });
});
