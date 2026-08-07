import { hash, verify } from '@node-rs/argon2';

import type { PasswordHasher } from '../../application/auth-ports.js';

export class ArgonPasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return hash(password, {
      algorithm: 2,
      memoryCost: 65_536,
      outputLen: 32,
      parallelism: 1,
      timeCost: 3,
    });
  }

  public verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
