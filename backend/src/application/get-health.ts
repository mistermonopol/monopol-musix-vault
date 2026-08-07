import type { HealthReport, ServiceStatus } from '../domain/health.js';

export interface Clock {
  now(): Date;
}

export class GetHealth {
  public constructor(
    private readonly clock: Clock,
    private readonly version: string,
  ) {}

  public execute(status: ServiceStatus): HealthReport {
    return {
      service: 'monopol-musix-vault-api',
      status,
      timestamp: this.clock.now().toISOString(),
      version: this.version,
    };
  }
}
