import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import type { AccessTokenClaims, TokenService } from '../../application/auth-ports.js';
import type { User } from '../../domain/user.js';
import type { AuthConfig } from '../config.js';

export class JwtTokenService implements TokenService {
  private readonly secret: Uint8Array;

  public constructor(private readonly config: AuthConfig) {
    this.secret = new TextEncoder().encode(config.secret);
  }

  public async createAccessToken(user: User): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setAudience('monopol-musix-vault-client')
      .setIssuer('monopol-musix-vault-api')
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTokenMinutes}m`)
      .sign(this.secret);
  }

  public createRefreshToken(): {
    readonly expiresAt: Date;
    readonly hash: string;
    readonly token: string;
  } {
    const token = randomBytes(32).toString('base64url');
    return {
      expiresAt: new Date(Date.now() + this.config.refreshTokenDays * 86_400_000),
      hash: this.hashRefreshToken(token),
      token,
    };
  }

  public hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const result = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
      audience: 'monopol-musix-vault-client',
      issuer: 'monopol-musix-vault-api',
    });
    if (result.payload.sub === undefined || typeof result.payload.role !== 'string') {
      throw new Error('Access token claims are incomplete');
    }
    return { role: result.payload.role, userId: result.payload.sub };
  }
}
