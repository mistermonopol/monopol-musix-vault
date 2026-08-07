import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { authenticate } from '../lib/api';
import { AuthScreen } from './AuthScreen';

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  authenticate: vi.fn(),
}));

const authenticateMock = vi.mocked(authenticate);

describe('AuthScreen', () => {
  it('requires a non-autocompleted access code and explains its use', () => {
    render(<AuthScreen onAuthenticated={vi.fn()} />);
    const input = screen.getByLabelText('Access Code');

    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAccessibleDescription(/kept only for this browser tab/i);
  });

  it('submits the access code with the account credentials', async () => {
    authenticateMock.mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-id', email: 'listener@example.com' },
    });
    render(<AuthScreen onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Email'), 'listener@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-password');
    await userEvent.type(screen.getByLabelText('Access Code'), 'vault-code');
    await userEvent.click(screen.getByRole('button', { name: 'Enter vault' }));

    expect(authenticateMock).toHaveBeenCalledWith(
      'login',
      'listener@example.com',
      'long-enough-password',
      'vault-code',
    );
  });

  it('switches to first-time setup', async () => {
    render(<AuthScreen onAuthenticated={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'First setup' }));
    expect(screen.getByRole('heading', { name: 'Open your vault.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create vault' })).toBeInTheDocument();
  });
});
