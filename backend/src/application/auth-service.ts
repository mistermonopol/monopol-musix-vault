import { AuthError, invalidCredentials, invalidToken } from './auth-errors.js';
import type { AuthRepository, PasswordHasher, TokenService } from './auth-ports.js';
import type { PublicUser, User } from '../domain/user.js';
import { toPublicUser } from '../domain/user.js';

export interface AuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: PublicUser;
}

export interface AuthOperations {
  bootstrap(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(refreshToken: string): Promise<void>;
  refresh(refreshToken: string): Promise<AuthResult>;
}

export class AuthService implements AuthOperations {
  public constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  public async bootstrap(email: string, password: string): Promise<AuthResult> {
    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.repository.bootstrapAdmin(email, passwordHash);
    if (user === null) {
      throw new AuthError('An administrator already exists', 'ALREADY_BOOTSTRAPPED', 409);
    }
    return this.issueTokens(user);
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(email);
    if (user === null || !(await this.passwordHasher.verify(user.passwordHash, password))) {
      throw invalidCredentials();
    }
    return this.issueTokens(user);
  }

  public async refresh(refreshToken: string): Promise<AuthResult> {
    const currentHash = this.tokenService.hashRefreshToken(refreshToken);
    const next = this.tokenService.createRefreshToken();
    const user = await this.repository.rotateRefreshSession(
      currentHash,
      next.hash,
      next.expiresAt,
    );
    if (user === null) {
      throw invalidToken();
    }
    return {
      accessToken: await this.tokenService.createAccessToken(user),
      refreshToken: next.token,
      user: toPublicUser(user),
    };
  }

  public async logout(refreshToken: string): Promise<void> {
    await this.repository.revokeRefreshSession(
      this.tokenService.hashRefreshToken(refreshToken),
    );
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const refresh = this.tokenService.createRefreshToken();
    await this.repository.createRefreshSession(user.id, refresh.hash, refresh.expiresAt);
    return {
      accessToken: await this.tokenService.createAccessToken(user),
      refreshToken: refresh.token,
      user: toPublicUser(user),
    };
  }
}
