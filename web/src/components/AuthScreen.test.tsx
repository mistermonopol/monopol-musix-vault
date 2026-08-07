import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  authenticate: vi.fn(),
}));

describe('AuthScreen', () => {
  it('switches to first-time setup', async () => {
    render(<AuthScreen onAuthenticated={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'First setup' }));
    expect(screen.getByRole('heading', { name: 'Open your vault.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create vault' })).toBeInTheDocument();
  });
});
