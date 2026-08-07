import type { Clock } from '../application/get-health.js';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
