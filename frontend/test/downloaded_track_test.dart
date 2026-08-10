import 'package:flutter_test/flutter_test.dart';
import 'package:monopol_musix_vault/src/features/downloads/domain/downloaded_track.dart';
import 'package:monopol_musix_vault/src/features/library/domain/catalog_track.dart';

void main() {
  test('download index preserves track metadata and local file details', () {
    final downloadedAt = DateTime.utc(2026, 8, 10, 12, 30);
    final index = DownloadIndex(
      items: [
        DownloadedTrack(
          track: const CatalogTrack(
            id: 'track-id',
            title: 'Offline title',
            artists: ['Artist one', 'Artist two'],
            album: 'Album',
            durationSeconds: 245.5,
            year: 2026,
            hasArtwork: true,
          ),
          localPath: '/private/vault_downloads/track-id.audio',
          sizeBytes: 12345678,
          downloadedAt: downloadedAt,
        ),
      ],
    );

    final restored = DownloadIndex.fromJson(index.toJson());
    final item = restored.items.single;

    expect(item.track.id, 'track-id');
    expect(item.track.title, 'Offline title');
    expect(item.track.artists, ['Artist one', 'Artist two']);
    expect(item.track.album, 'Album');
    expect(item.track.durationSeconds, 245.5);
    expect(item.track.year, 2026);
    expect(item.track.hasArtwork, isTrue);
    expect(item.localPath, '/private/vault_downloads/track-id.audio');
    expect(item.sizeBytes, 12345678);
    expect(item.downloadedAt, downloadedAt);
    expect(index.toJson().toString(), isNot(contains('token')));
  });
}
