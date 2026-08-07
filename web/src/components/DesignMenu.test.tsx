import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DesignMenu } from './DesignMenu';

describe('DesignMenu', () => {
  it('shows the active design and navigates from the menu', async () => {
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<DesignMenu activePath="/spotify" onNavigate={navigate} />);

    const trigger = screen.getByRole('button', { name: /UI Design/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Spotify/i })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemradio', { name: /Apple Music/i }));
    expect(navigate).toHaveBeenCalledWith('/applemusic');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens with the keyboard', async () => {
    const user = userEvent.setup();
    render(<DesignMenu activePath="/soundcloud" onNavigate={vi.fn()} />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /SoundCloud/i })).toHaveAttribute('aria-checked', 'true');
  });
});
