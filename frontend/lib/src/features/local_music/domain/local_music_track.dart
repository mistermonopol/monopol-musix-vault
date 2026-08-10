import '../../library/domain/catalog_track.dart';
import '../../player/domain/playback_source.dart';

final class LocalMusicTrack {
  const LocalMusicTrack({required this.track, required this.contentUri});

  factory LocalMusicTrack.fromPlatform(Map<Object?, Object?> value) {
    final mediaId = value['id'] as int;
    final artist = (value['artist'] as String?)?.trim();
    final album = (value['album'] as String?)?.trim();
    final durationMs = value['durationMs'] as int?;
    return LocalMusicTrack(
      track: CatalogTrack(
        id: 'local:$mediaId',
        title: (value['title'] as String?)?.trim().isNotEmpty == true
            ? (value['title'] as String).trim()
            : 'Unbekannter Titel',
        artists: artist == null || artist.isEmpty || artist == '<unknown>'
            ? const []
            : [artist],
        album: album == null || album.isEmpty || album == '<unknown>'
            ? null
            : album,
        durationSeconds: durationMs == null ? null : durationMs / 1000,
        year: null,
        hasArtwork: false,
      ),
      contentUri: Uri.parse(value['contentUri']! as String),
    );
  }

  final CatalogTrack track;
  final Uri contentUri;

  PlaybackSource toPlaybackSource() =>
      PlaybackSource(track: track, uri: contentUri, headers: const {});
}
