import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { syncObsidianBrain } from '../lib/api';
import { themeForPath } from '../lib/themes';
import { SettingsView } from './SettingsView';

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  syncObsidianBrain: vi.fn(),
}));

const syncMock = vi.mocked(syncObsidianBrain);
const baseProps = {
  theme: themeForPath('/spotify'),
  uiSettings: { denseLayout: false },
  onUiSettingsChange: vi.fn(),
  onThemeChange: vi.fn(),
  onNavigate: vi.fn(),
};

describe('SettingsView', () => {
  it('shows account and safe API details without admin mutations for members', () => {
    render(<SettingsView {...baseProps} user={{ id: '1', email: 'member@example.com', role: 'member' }} />);
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText('/api')).toBeInTheDocument();
    expect(screen.getByText(/Administrative actions are hidden/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Brain Sync/i })).not.toBeInTheDocument();
  });

  it('persists preference changes through its callback', async () => {
    const onUiSettingsChange = vi.fn();
    render(<SettingsView {...baseProps} onUiSettingsChange={onUiSettingsChange} user={{ id: '1', email: 'member@example.com' }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Dense layout/i }));
    expect(onUiSettingsChange).toHaveBeenCalledWith({ denseLayout: true });
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
