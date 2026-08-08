enum ListeningEventType { started, progress, paused, completed }

final class RecentListeningItem {
  const RecentListeningItem({
    required this.trackId,
    required this.eventType,
    required this.positionSeconds,
    required this.occurredAt,
    required this.updatedAt,
  });

  factory RecentListeningItem.fromJson(Map<String, Object?> json) =>
      RecentListeningItem(
        trackId: json['trackId'] as String,
        eventType: ListeningEventType.values.byName(
          json['eventType'] as String,
        ),
        positionSeconds: (json['positionSeconds'] as num).toDouble(),
        occurredAt: DateTime.parse(json['occurredAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );

  final String trackId;
  final ListeningEventType eventType;
  final double positionSeconds;
  final DateTime occurredAt;
  final DateTime updatedAt;
}

final class ListeningPosition {
  const ListeningPosition({
    required this.trackId,
    required this.positionSeconds,
    required this.updatedAt,
  });

  factory ListeningPosition.fromJson(Map<String, Object?> json) =>
      ListeningPosition(
        trackId: json['trackId'] as String,
        positionSeconds: (json['positionSeconds'] as num).toDouble(),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );

  final String trackId;
  final double positionSeconds;
  final DateTime updatedAt;
}

final class VaultPlaylistItem {
  const VaultPlaylistItem({
    required this.id,
    required this.trackId,
    required this.position,
  });

  factory VaultPlaylistItem.fromJson(Map<String, Object?> json) =>
      VaultPlaylistItem(
        id: json['id'] as String,
        trackId: json['trackId'] as String,
        position: (json['position'] as num).toInt(),
      );

  final String id;
  final String trackId;
  final int position;
}

final class VaultPlaylist {
  const VaultPlaylist({
    required this.id,
    required this.name,
    required this.description,
    required this.items,
    required this.createdAt,
    required this.updatedAt,
  });

  factory VaultPlaylist.fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    return VaultPlaylist(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      items: rawItems is List
          ? rawItems
                .whereType<Map<String, Object?>>()
                .map(VaultPlaylistItem.fromJson)
                .toList(growable: false)
          : const [],
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  final String id;
  final String name;
  final String description;
  final List<VaultPlaylistItem> items;
  final DateTime createdAt;
  final DateTime updatedAt;
}

final class VaultDevice {
  const VaultDevice({
    required this.id,
    required this.name,
    required this.kind,
    required this.createdAt,
    required this.lastSeenAt,
  });

  factory VaultDevice.fromJson(Map<String, Object?> json) => VaultDevice(
    id: json['id'] as String,
    name: json['name'] as String,
    kind: json['kind'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    lastSeenAt: DateTime.parse(json['lastSeenAt'] as String),
  );

  final String id;
  final String name;
  final String kind;
  final DateTime createdAt;
  final DateTime lastSeenAt;
}

final class QueueSnapshot {
  const QueueSnapshot({
    required this.deviceId,
    required this.items,
    required this.currentIndex,
    required this.positionSeconds,
    required this.updatedAt,
  });

  factory QueueSnapshot.fromJson(Map<String, Object?> json) => QueueSnapshot(
    deviceId: json['deviceId'] as String,
    items: (json['items'] as List? ?? const []).whereType<String>().toList(),
    currentIndex: (json['currentIndex'] as num?)?.toInt(),
    positionSeconds: (json['positionSeconds'] as num).toDouble(),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
  );

  final String deviceId;
  final List<String> items;
  final int? currentIndex;
  final double positionSeconds;
  final DateTime updatedAt;
}

final class QueueTransferResult {
  const QueueTransferResult({required this.queue, required this.autoPlay});

  factory QueueTransferResult.fromJson(Map<String, Object?> json) =>
      QueueTransferResult(
        queue: QueueSnapshot.fromJson(json['queue'] as Map<String, Object?>),
        autoPlay: json['autoPlay'] as bool? ?? false,
      );

  final QueueSnapshot queue;
  final bool autoPlay;
}

final class BrainNode {
  const BrainNode({
    required this.id,
    required this.label,
    required this.type,
    required this.properties,
  });

  factory BrainNode.fromJson(Map<String, Object?> json) {
    final rawProperties = json['properties'];
    return BrainNode(
      id: json['id'] as String,
      label: json['label'] as String,
      type: json['type'] as String,
      properties: rawProperties is Map<String, Object?>
          ? Map.unmodifiable(
              Map.fromEntries(
                rawProperties.entries.where(
                  (entry) =>
                      entry.value == null ||
                      entry.value is bool ||
                      entry.value is num ||
                      entry.value is String,
                ),
              ),
            )
          : const {},
    );
  }

  final String id;
  final String label;
  final String type;
  final Map<String, Object?> properties;
}

final class BrainEdge {
  const BrainEdge({
    required this.id,
    required this.source,
    required this.target,
    required this.type,
  });

  factory BrainEdge.fromJson(Map<String, Object?> json) => BrainEdge(
    id: json['id'] as String,
    source: json['source'] as String,
    target: json['target'] as String,
    type: json['type'] as String,
  );

  final String id;
  final String source;
  final String target;
  final String type;
}

final class BrainGraph {
  const BrainGraph({required this.nodes, required this.edges});

  factory BrainGraph.fromJson(Map<String, Object?> json) => BrainGraph(
    nodes: (json['nodes'] as List? ?? const [])
        .whereType<Map<String, Object?>>()
        .map(BrainNode.fromJson)
        .toList(growable: false),
    edges: (json['edges'] as List? ?? const [])
        .whereType<Map<String, Object?>>()
        .map(BrainEdge.fromJson)
        .toList(growable: false),
  );

  final List<BrainNode> nodes;
  final List<BrainEdge> edges;
}

final class BrainSyncCounts {
  const BrainSyncCounts({
    required this.albums,
    required this.artists,
    required this.genres,
    required this.tracks,
  });

  factory BrainSyncCounts.fromJson(Map<String, Object?> json) =>
      BrainSyncCounts(
        albums: (json['albums'] as num).toInt(),
        artists: (json['artists'] as num).toInt(),
        genres: (json['genres'] as num).toInt(),
        tracks: (json['tracks'] as num).toInt(),
      );

  final int albums;
  final int artists;
  final int genres;
  final int tracks;
}

final class BrainSyncError {
  const BrainSyncError({required this.message, this.noteId, this.noteType});

  factory BrainSyncError.fromJson(Map<String, Object?> json) => BrainSyncError(
    message: json['message'] as String,
    noteId: json['noteId'] as String?,
    noteType: json['noteType'] as String?,
  );

  final String message;
  final String? noteId;
  final String? noteType;
}

final class BrainSyncResult {
  const BrainSyncResult({required this.counts, required this.errors});

  factory BrainSyncResult.fromJson(Map<String, Object?> json) =>
      BrainSyncResult(
        counts: BrainSyncCounts.fromJson(
          json['counts'] as Map<String, Object?>,
        ),
        errors: (json['errors'] as List? ?? const [])
            .whereType<Map<String, Object?>>()
            .map(BrainSyncError.fromJson)
            .toList(growable: false),
      );

  final BrainSyncCounts counts;
  final List<BrainSyncError> errors;
}
