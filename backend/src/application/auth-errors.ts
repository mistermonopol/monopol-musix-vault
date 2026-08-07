export class AuthError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const invalidCredentials = (): AuthError =>
  new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);

export const invalidToken = (): AuthError =>
  new AuthError('Invalid or expired token', 'INVALID_TOKEN', 401);
