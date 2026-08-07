export interface LibraryRoot {
  readonly id: string;
  readonly path: string;
}

export type ScanStatus = 'completed' | 'failed';

export interface ScanCounts {
  readonly discovered: number;
  readonly failed: number;
  readonly missing: number;
  readonly processed: number;
  readonly unchanged: number;
}

export interface ScanFileError {
  readonly message: string;
  readonly path: string;
}

export interface ScanProgress extends ScanCounts {
  readonly currentPath: string | null;
  readonly phase: 'discovering' | 'processing' | 'reconciling' | 'complete';
  readonly scanId: string;
}

export interface ScanResult extends ScanCounts {
  readonly errors: readonly ScanFileError[];
  readonly finishedAt: Date;
  readonly scanId: string;
  readonly startedAt: Date;
  readonly status: ScanStatus;
}
