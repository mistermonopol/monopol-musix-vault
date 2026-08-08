import { describe, expect, it } from 'vitest';

import { PostgresBrainGraph } from '../src/infrastructure/obsidian/postgres-brain-graph.js';

const userId = '00000000-0000-4000-8000-000000000001';

describe('PostgresBrainGraph', () => {
  it('builds metadata-rich catalog and user-scoped relationship queries', async () => {
    const statements: { text: string; values: readonly unknown[] }[] = [];
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?');
      statements.push({ text, values });
      if (text.includes("SELECT 'track:'")) {
        return Promise.resolve([{
          id: 'track:t1',
          label: 'Song',
          properties: {
            codec: 'FLAC', durationSeconds: 180, favorite: true,
            hasArtwork: true, releaseDate: '2026', year: 2026,
          },
          type: 'track',
        }, { id: 'favorites:mine', label: 'Favorites', properties: {}, type: 'favorites' }]);
      }
      return Promise.resolve([
        { id: 'playlist:p1:track:t1', source: 'playlist:p1', target: 'track:t1', type: 'playlist' },
        { id: 'favorites:mine:track:t1', source: 'favorites:mine', target: 'track:t1', type: 'favorite' },
      ]);
    };

    const graph = await new PostgresBrainGraph(sql as never).get(userId);

    expect(graph.nodes[0]?.properties).toMatchObject({
      codec: 'FLAC', durationSeconds: 180, favorite: true, hasArtwork: true, year: 2026,
    });
    expect(graph.edges.map((edge) => edge.type)).toEqual(['playlist', 'favorite']);
    expect(statements).toHaveLength(2);
    expect(statements.flatMap((statement) => statement.values)).toEqual([userId, userId, userId, userId]);
    expect(statements[0]?.text).toContain("'playlist'");
    expect(statements[0]?.text).toContain("'favorites:mine'");
    expect(statements[1]?.text).toContain('p.user_id = ?::uuid');
    expect(statements[1]?.text).toContain('f.user_id = ?::uuid');
    expect(statements.map((statement) => statement.text).join('\n')).not.toMatch(/relative_path|library_roots\.path/i);
  });
});
