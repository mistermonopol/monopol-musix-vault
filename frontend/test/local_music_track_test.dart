import 'package:flutter_test/flutter_test.dart';
import 'package:monopol_musix_vault/src/features/local_music/domain/local_music_track.dart';

void main() {
  test('maps MediaStore metadata to a distinct local playback source', () {
    final item = LocalMusicTrack.fromPlatform({
      'id': 42,
      'title': 'Local Song',
      'artist': 'Device Artist',
      'album': 'Phone Album',
      'durationMs': 123000,
      'contentUri': 'content://media/external/audio/media/42',
    });

    expect(item.track.id, 'local:42');
    expect(item.track.title, 'Local Song');
    expect(item.track.artistLabel, 'Device Artist');
    expect(item.track.durationSeconds, 123);
    expect(item.toPlaybackSource().uri.scheme, 'content');
    expect(item.toPlaybackSource().headers, isEmpty);
  });

  test('normalizes unknown Android metadata', () {
    final item = LocalMusicTrack.fromPlatform({
      'id': 7,
      'title': '',
      'artist': '<unknown>',
      'album': '<unknown>',
      'durationMs': 1000,
      'contentUri': 'content://media/external/audio/media/7',
    });

    expect(item.track.title, 'Unbekannter Titel');
    expect(item.track.artists, isEmpty);
    expect(item.track.album, isNull);
  });
}
