export type ServiceStatus = 'ok' | 'ready';

export interface HealthReport {
  readonly service: 'monopol-musix-vault-api';
  readonly status: ServiceStatus;
  readonly timestamp: string;
  readonly version: string;
}
