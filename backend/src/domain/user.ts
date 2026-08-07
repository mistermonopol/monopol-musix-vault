export type UserRole = 'admin' | 'user';

export interface User {
  readonly createdAt: Date;
  readonly email: string;
  readonly id: string;
  readonly passwordHash: string;
  readonly role: UserRole;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
