final class CatalogTrack {
  const CatalogTrack({
    required this.id,
    required this.title,
    required this.artists,
    required this.album,
    required this.durationSeconds,
    required this.year,
  });

  factory CatalogTrack.fromJson(Map<String, Object?> json) {
    final artistsJson = json['artists'];
    final albumJson = json['album'];
    return CatalogTrack(
      id: json['id'] as String,
      title: json['title'] as String,
      artists: artistsJson is List
          ? artistsJson
                .whereType<Map<String, Object?>>()
                .map((artist) => artist['name'])
                .whereType<String>()
                .toList(growable: false)
          : const [],
      album: albumJson is Map<String, Object?>
          ? albumJson['title'] as String?
          : null,
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble(),
      year: (json['year'] as num?)?.toInt(),
    );
  }

  final String id;
  final String title;
  final List<String> artists;
  final String? album;
  final double? durationSeconds;
  final int? year;

  String get artistLabel =>
      artists.isEmpty ? 'Unbekannter Künstler' : artists.join(', ');
}

final class CatalogPage {
  const CatalogPage({required this.items, required this.total});

  factory CatalogPage.fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    return CatalogPage(
      items: rawItems is List
          ? rawItems
                .whereType<Map<String, Object?>>()
                .map(CatalogTrack.fromJson)
                .toList(growable: false)
          : const [],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }

  final List<CatalogTrack> items;
  final int total;
}
