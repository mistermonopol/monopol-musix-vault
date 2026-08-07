export interface DatabaseHealth {
  isReady(): Promise<boolean>;
}
