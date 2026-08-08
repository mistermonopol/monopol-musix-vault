import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '../lib/types';
import { Artwork } from './Artwork';

const getTrackArtwork = vi.fn();
vi.mock('../lib/api', () => ({ getTrackArtwork: (...args: unknown[]) => getTrackArtwork(...args) }));

const track: Track = { id: 'track-1', title: 'Night Drive', artists: ['Artist'], album: 'Album', durationSeconds: 120, year: 2026, hasArtwork: true };

afterEach(() => { vi.restoreAllMocks(); getTrackArtwork.mockReset(); });

describe('Artwork', () => {
  it('renders fetched artwork from an object URL and revokes it after unmount', async () => {
    getTrackArtwork.mockResolvedValue(new Blob(['cover'], { type: 'image/jpeg' }));
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cover');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { container, unmount } = render(<Artwork track={track} />);

    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'blob:cover'));
    expect(createObjectURL).toHaveBeenCalledOnce();
    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:cover'));
  });

  it('retains the generated fallback when artwork is unavailable', () => {
    const { container } = render(<Artwork track={{ ...track, hasArtwork: false }} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(getTrackArtwork).not.toHaveBeenCalled();
  });
});
