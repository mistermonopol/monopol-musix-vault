export interface User {
  readonly id: string;
  readonly email: string;
  readonly role?: string;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: User;
}

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artists: readonly string[];
  readonly album: string | null;
  readonly durationSeconds: number | null;
  readonly year: number | null;
}

export interface TrackPage {
  readonly tracks: readonly Track[];
  readonly total: number;
}

export interface BrainSyncResult {
  readonly counts: {
    readonly albums: number;
    readonly artists: number;
    readonly genres: number;
    readonly tracks: number;
  };
  readonly errors: readonly { readonly message: string }[];
}

export interface ScanResult {
  readonly status: string;
  readonly processed: number;
  readonly discovered: number;
  readonly failed: number;
}
