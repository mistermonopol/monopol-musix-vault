enum ArtworkLookupState { idle, running, completed }

final class ArtworkLookupProgress {
  const ArtworkLookupProgress({
    required this.state,
    required this.queued,
    required this.attempted,
    required this.matched,
    required this.coversApplied,
    required this.tracksUpdated,
    required this.noMatch,
    required this.noCover,
    required this.failed,
    required this.errors,
    required this.startedAt,
    required this.finishedAt,
  });

  factory ArtworkLookupProgress.fromJson(Map<String, Object?> json) {
    return ArtworkLookupProgress(
      state: ArtworkLookupState.values.firstWhere(
        (state) => state.name == json['state'],
        orElse: () => ArtworkLookupState.idle,
      ),
      queued: _count(json, 'queued'),
      attempted: _count(json, 'attempted'),
      matched: _count(json, 'matched'),
      coversApplied: _count(json, 'coversApplied'),
      tracksUpdated: _count(json, 'tracksUpdated'),
      noMatch: _count(json, 'noMatch'),
      noCover: _count(json, 'noCover'),
      failed: _count(json, 'failed'),
      errors: (json['errors'] as List? ?? const [])
          .whereType<String>()
          .toList(),
      startedAt: _date(json['startedAt']),
      finishedAt: _date(json['finishedAt']),
    );
  }

  final ArtworkLookupState state;
  final int queued;
  final int attempted;
  final int matched;
  final int coversApplied;
  final int tracksUpdated;
  final int noMatch;
  final int noCover;
  final int failed;
  final List<String> errors;
  final DateTime? startedAt;
  final DateTime? finishedAt;

  bool get isRunning => state == ArtworkLookupState.running;

  static int _count(Map<String, Object?> json, String key) =>
      (json[key] as num?)?.toInt() ?? 0;

  static DateTime? _date(Object? value) =>
      value is String ? DateTime.tryParse(value) : null;
}
