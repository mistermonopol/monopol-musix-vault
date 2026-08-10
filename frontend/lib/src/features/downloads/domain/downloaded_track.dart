import '../../library/domain/catalog_track.dart';

final class DownloadedTrack {
  const DownloadedTrack({
    required this.track,
    required this.localPath,
    required this.sizeBytes,
    required this.downloadedAt,
  });

  factory DownloadedTrack.fromJson(Map<String, Object?> json) {
    final metadata = json['track'];
    if (metadata is! Map<String, Object?>) {
      throw const FormatException('Missing track metadata');
    }
    return DownloadedTrack(
      track: CatalogTrack.fromJson(metadata),
      localPath: json['localPath'] as String,
      sizeBytes: (json['sizeBytes'] as num).toInt(),
      downloadedAt: DateTime.parse(json['downloadedAt'] as String),
    );
  }

  final CatalogTrack track;
  final String localPath;
  final int sizeBytes;
  final DateTime downloadedAt;

  Map<String, Object?> toJson() => {
    'track': {
      'id': track.id,
      'title': track.title,
      'artists': [
        for (final artist in track.artists) {'name': artist},
      ],
      'album': track.album == null ? null : {'title': track.album},
      'durationSeconds': track.durationSeconds,
      'year': track.year,
      'hasArtwork': track.hasArtwork,
    },
    'localPath': localPath,
    'sizeBytes': sizeBytes,
    'downloadedAt': downloadedAt.toUtc().toIso8601String(),
  };
}

final class DownloadIndex {
  const DownloadIndex({required this.items});

  factory DownloadIndex.fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    return DownloadIndex(
      items: rawItems is List
          ? rawItems
                .whereType<Map<String, Object?>>()
                .map(DownloadedTrack.fromJson)
                .toList(growable: false)
          : const [],
    );
  }

  final List<DownloadedTrack> items;

  Map<String, Object?> toJson() => {
    'version': 1,
    'items': items.map((item) => item.toJson()).toList(growable: false),
  };
}
