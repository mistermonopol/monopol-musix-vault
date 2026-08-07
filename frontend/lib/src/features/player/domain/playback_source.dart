import '../../library/domain/catalog_track.dart';

final class PlaybackSource {
  const PlaybackSource({
    required this.track,
    required this.uri,
    required this.headers,
  });

  final CatalogTrack track;
  final Uri uri;
  final Map<String, String> headers;
}
