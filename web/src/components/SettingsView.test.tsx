import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getArtworkLookupStatus, startArtworkLookup, syncObsidianBrain } from '../lib/api';
import { themeForPath } from '../lib/themes';
import { SettingsView } from './SettingsView';

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  getArtworkLookupStatus: vi.fn(),
  startArtworkLookup: vi.fn(),
  syncObsidianBrain: vi.fn(),
}));

const syncMock = vi.mocked(syncObsidianBrain);
const statusMock = vi.mocked(getArtworkLookupStatus);
const startMock = vi.mocked(startArtworkLookup);
const idleStatus = { attempted: 0, coversApplied: 0, errors: [], failed: 0, finishedAt: null, matched: 0, noCover: 0, noMatch: 0, queued: 0, startedAt: null, state: 'idle' as const, tracksUpdated: 0 };
const runningStatus = { ...idleStatus, queued: 4, attempted: 1, matched: 1, state: 'running' as const };
const baseProps = {
  theme: themeForPath('/spotify'),
  uiSettings: { denseLayout: false },
  onUiSettingsChange: vi.fn(),
  onThemeChange: vi.fn(),
  onNavigate: vi.fn(),
  onLibraryRefresh: vi.fn(),
};

beforeEach(() => {
  statusMock.mockResolvedValue(idleStatus);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SettingsView', () => {
  it('shows account and safe API details without admin mutations for members', () => {
    render(<SettingsView {...baseProps} user={{ id: '1', email: 'member@example.com', role: 'member' }} />);
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText('/api')).toBeInTheDocument();
    expect(screen.getByText(/Administrative actions are hidden/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Brain Sync/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cover lookup/i })).not.toBeInTheDocument();
  });

  it('persists preference changes through its callback', async () => {
    const onUiSettingsChange = vi.fn();
    render(<SettingsView {...baseProps} onUiSettingsChange={onUiSettingsChange} user={{ id: '1', email: 'member@example.com' }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Dense layout/i }));
    expect(onUiSettingsChange).toHaveBeenCalledWith({ denseLayout: true });
  });

  it('starts a retry lookup, polls progress, and refreshes the library on completion', async () => {
    vi.useFakeTimers();
    const onLibraryRefresh = vi.fn();
    startMock.mockResolvedValueOnce(runningStatus);
    statusMock.mockResolvedValueOnce(idleStatus).mockResolvedValueOnce({ ...runningStatus, attempted: 4, coversApplied: 2, failed: 1, finishedAt: '2026-08-08T12:00:00.000Z', state: 'completed', tracksUpdated: 7 });
    render(<SettingsView {...baseProps} onLibraryRefresh={onLibraryRefresh} user={{ id: '1', email: 'admin@example.com', role: 'admin' }} />);

    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /Retry previous attempts/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start cover lookup' })); });
    expect(startMock).toHaveBeenCalledWith(true);
    expect(screen.getByText('Looking up covers…')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(onLibraryRefresh).toHaveBeenCalledOnce();
  });

  it('shows detailed Brain sync results to admins', async () => {
    syncMock.mockResolvedValueOnce({ counts: { albums: 2, artists: 3, genres: 4, tracks: 5 }, errors: [{ message: 'One note failed' }] });
    render(<SettingsView {...baseProps} user={{ id: '1', email: 'admin@example.com', role: 'admin' }} />);
    await userEvent.click(screen.getByRole('button', { name: /Brain Sync/i }));
    expect(await screen.findByText('Sync complete')).toBeInTheDocument();
    expect(screen.getByText('One note failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh in Brain' })).toBeInTheDocument();
  });
});
