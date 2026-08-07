import type { PublicUser, User } from '../domain/user.js';

export interface AuthRepository {
  bootstrapAdmin(email: string, passwordHash: string): Promise<User | null>;
  createRefreshSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<PublicUser | null>;
  revokeRefreshSession(tokenHash: string): Promise<void>;
  rotateRefreshSession(
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
  ): Promise<User | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  readonly role: string;
  readonly userId: string;
}

export interface TokenService {
  createAccessToken(user: User): Promise<string>;
  createRefreshToken(): { readonly expiresAt: Date; readonly hash: string; readonly token: string };
  hashRefreshToken(token: string): string;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}
