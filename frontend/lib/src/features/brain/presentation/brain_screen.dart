import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../user_data/domain/user_data_models.dart';

final class BrainScreen extends StatefulWidget {
  const BrainScreen({required this.authController, super.key});

  final AuthController authController;

  @override
  State<BrainScreen> createState() => _BrainScreenState();
}

final class _BrainScreenState extends State<BrainScreen> {
  BrainGraph? _graph;
  BrainNode? _selectedNode;
  BrainSyncResult? _syncResult;
  bool _loading = true;
  bool _syncing = false;
  String? _error;

  bool get _isAdmin => widget.authController.session?.user.role == 'admin';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _graph == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error case final error?) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.hub_outlined, size: 56),
            const SizedBox(height: 12),
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('Erneut versuchen'),
            ),
          ],
        ),
      );
    }
    final graph = _graph!;
    final visibleNodes = graph.nodes.take(120).toList(growable: false);
    final ids = visibleNodes.map((node) => node.id).toSet();
    final visibleEdges = graph.edges
        .where((edge) => ids.contains(edge.source) && ids.contains(edge.target))
        .toList(growable: false);
    return Column(
      children: [
        _toolbar(graph, visibleNodes.length),
        if (_syncResult != null) _syncSummary(_syncResult!),
        const _GraphLegend(),
        if (graph.nodes.isEmpty)
          const Expanded(
            child: Center(child: Text('Der Brain-Graph ist leer.')),
          )
        else
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final detailsWidth = constraints.maxWidth >= 800 ? 280.0 : 0.0;
                return Row(
                  children: [
                    Expanded(
                      child: InteractiveViewer(
                        minScale: .25,
                        maxScale: 4,
                        boundaryMargin: const EdgeInsets.all(800),
                        constrained: false,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTapDown: (details) => _selectAt(
                            details.localPosition,
                            visibleNodes,
                            const Size(1200, 900),
                          ),
                          child: CustomPaint(
                            size: const Size(1200, 900),
                            painter: _GraphPainter(
                              visibleNodes,
                              visibleEdges,
                              Theme.of(context).colorScheme,
                              _selectedNode?.id,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (detailsWidth > 0)
                      SizedBox(
                        width: detailsWidth,
                        child: _NodeDetails(node: _selectedNode),
                      ),
                  ],
                );
              },
            ),
          ),
        if (_selectedNode != null)
          LayoutBuilder(
            builder: (context, constraints) => constraints.maxWidth < 800
                ? ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 180),
                    child: _NodeDetails(node: _selectedNode),
                  )
                : const SizedBox.shrink(),
          ),
      ],
    );
  }

  Widget _toolbar(BrainGraph graph, int visibleCount) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            '${graph.nodes.length} Knoten • ${graph.edges.length} Verbindungen${graph.nodes.length > visibleCount ? ' • erste $visibleCount angezeigt' : ''}',
          ),
        ),
        if (_isAdmin)
          FilledButton.tonalIcon(
            onPressed: _syncing ? null : _sync,
            icon: _syncing
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.sync),
            label: const Text('Brain Sync'),
          ),
        IconButton(
          onPressed: _loading ? null : _load,
          tooltip: 'Aktualisieren',
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
  );

  Widget _syncSummary(BrainSyncResult result) {
    final counts = result.counts;
    final hasErrors = result.errors.isNotEmpty;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      color: hasErrors
          ? Theme.of(context).colorScheme.errorContainer
          : Theme.of(context).colorScheme.secondaryContainer,
      child: ExpansionTile(
        initiallyExpanded: hasErrors,
        leading: Icon(hasErrors ? Icons.warning_amber : Icons.check_circle),
        title: Text(
          'Sync abgeschlossen: ${counts.tracks} Titel, ${counts.artists} Künstler, ${counts.albums} Alben, ${counts.genres} Genres',
        ),
        subtitle: Text(
          hasErrors
              ? '${result.errors.length} Fehler'
              : 'Keine Fehler gemeldet',
        ),
        children: [
          for (final error in result.errors)
            ListTile(
              dense: true,
              leading: const Icon(Icons.error_outline),
              title: Text(error.message),
              subtitle: error.noteId == null
                  ? null
                  : Text('${error.noteType ?? 'note'} • ${error.noteId}'),
            ),
        ],
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final graph = await widget.authController.getBrainGraph();
      if (!mounted) return;
      setState(() {
        _graph = graph;
        if (_selectedNode != null) {
          _selectedNode = graph.nodes.cast<BrainNode?>().firstWhere(
            (node) => node?.id == _selectedNode?.id,
            orElse: () => null,
          );
        }
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sync() async {
    setState(() {
      _syncing = true;
      _syncResult = null;
    });
    try {
      final result = await widget.authController.syncBrain();
      if (!mounted) return;
      setState(() => _syncResult = result);
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Brain Sync fehlgeschlagen: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  void _selectAt(Offset position, List<BrainNode> nodes, Size size) {
    final points = _nodePoints(nodes, size);
    BrainNode? closest;
    var distance = 24.0;
    for (final node in nodes) {
      final candidate = (points[node.id]! - position).distance;
      if (candidate < distance) {
        closest = node;
        distance = candidate;
      }
    }
    if (closest != null) setState(() => _selectedNode = closest);
  }
}

final class _NodeDetails extends StatelessWidget {
  const _NodeDetails({required this.node});

  final BrainNode? node;

  @override
  Widget build(BuildContext context) {
    final selected = node;
    return Card(
      margin: const EdgeInsets.all(12),
      child: selected == null
          ? const Padding(
              padding: EdgeInsets.all(20),
              child: Text('Knoten auswählen, um Details anzuzeigen.'),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              shrinkWrap: true,
              children: [
                Row(
                  children: [
                    Icon(_nodeIcon(selected.type)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        selected.label,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ],
                ),
                Text(_typeLabel(selected.type)),
                const Divider(),
                if (selected.properties.isEmpty)
                  const Text('Keine Metadaten')
                else
                  for (final entry in selected.properties.entries)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: Text(_propertyLabel(entry.key))),
                          const SizedBox(width: 12),
                          Flexible(
                            child: Text(
                              _propertyValue(entry.key, entry.value),
                              textAlign: TextAlign.end,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
              ],
            ),
    );
  }

  String _propertyValue(String key, Object? value) {
    if (value == null) return '—';
    if (value is bool) return value ? 'Ja' : 'Nein';
    if (key == 'durationSeconds' && value is num) {
      final seconds = value.round();
      return '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
    }
    return '$value';
  }

  String _propertyLabel(String key) => switch (key) {
    'year' => 'Jahr',
    'releaseDate' => 'Veröffentlichung',
    'durationSeconds' => 'Dauer',
    'codec' => 'Codec',
    'favorite' => 'Favorit',
    'hasArtwork' => 'Artwork',
    'description' => 'Beschreibung',
    'trackCount' => 'Titel',
    _ => key,
  };
}

final class _GraphLegend extends StatelessWidget {
  const _GraphLegend();

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    child: Row(
      children: [
        for (final type in const [
          'track',
          'artist',
          'album',
          'genre',
          'playlist',
          'favorites',
        ])
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: Chip(
              avatar: Icon(
                _nodeIcon(type),
                size: 18,
                color: _nodeColor(type, Theme.of(context).colorScheme),
              ),
              label: Text(_typeLabel(type)),
            ),
          ),
        const Text(
          'Verbindungen: Künstler • Album • Genre • Playlist • Favorit',
        ),
      ],
    ),
  );
}

final class _GraphPainter extends CustomPainter {
  _GraphPainter(this.nodes, this.edges, this.colors, this.selectedId);

  final List<BrainNode> nodes;
  final List<BrainEdge> edges;
  final ColorScheme colors;
  final String? selectedId;

  @override
  void paint(Canvas canvas, Size size) {
    final points = _nodePoints(nodes, size);
    for (final edge in edges) {
      final source = points[edge.source];
      final target = points[edge.target];
      if (source == null || target == null) continue;
      canvas.drawLine(
        source,
        target,
        Paint()
          ..color = _edgeColor(edge.type, colors).withValues(alpha: .55)
          ..strokeWidth = edge.type == 'favorite' ? 2.5 : 1.2,
      );
    }
    for (final node in nodes) {
      final point = points[node.id]!;
      final radius = node.type == 'track' ? 8.0 : 12.0;
      if (node.id == selectedId) {
        canvas.drawCircle(
          point,
          radius + 5,
          Paint()
            ..color = colors.onSurface
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3,
        );
      }
      canvas.drawCircle(
        point,
        radius,
        Paint()..color = _nodeColor(node.type, colors),
      );
      final label = TextPainter(
        text: TextSpan(
          text: node.label,
          style: TextStyle(color: colors.onSurface, fontSize: 11),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: 110);
      label.paint(canvas, point + Offset(-label.width / 2, radius + 4));
    }
  }

  @override
  bool shouldRepaint(covariant _GraphPainter oldDelegate) =>
      oldDelegate.nodes != nodes ||
      oldDelegate.edges != edges ||
      oldDelegate.colors != colors ||
      oldDelegate.selectedId != selectedId;
}

Map<String, Offset> _nodePoints(List<BrainNode> nodes, Size size) {
  final center = Offset(size.width / 2, size.height / 2);
  final radius = math.min(size.width, size.height) * .4;
  final points = <String, Offset>{};
  for (var i = 0; i < nodes.length; i++) {
    final ring = 1 + i ~/ 30;
    final ringIndex = i % 30;
    final count = math.min(30, nodes.length - (ring - 1) * 30);
    final angle = -math.pi / 2 + 2 * math.pi * ringIndex / count;
    points[nodes[i].id] =
        center + Offset(math.cos(angle), math.sin(angle)) * (radius * ring / 4);
  }
  return points;
}

Color _nodeColor(String type, ColorScheme colors) => switch (type) {
  'artist' => colors.primary,
  'album' => colors.tertiary,
  'genre' => colors.secondary,
  'playlist' => colors.error,
  'favorites' => Colors.pinkAccent,
  _ => colors.onSurfaceVariant,
};

Color _edgeColor(String type, ColorScheme colors) => switch (type) {
  'artist' => colors.primary,
  'album' => colors.tertiary,
  'genre' => colors.secondary,
  'playlist' => colors.error,
  'favorite' => Colors.pinkAccent,
  _ => colors.outlineVariant,
};

IconData _nodeIcon(String type) => switch (type) {
  'artist' => Icons.person,
  'album' => Icons.album,
  'genre' => Icons.sell,
  'playlist' => Icons.queue_music,
  'favorites' => Icons.favorite,
  _ => Icons.music_note,
};

String _typeLabel(String type) => switch (type) {
  'track' => 'Titel',
  'artist' => 'Künstler',
  'album' => 'Album',
  'genre' => 'Genre',
  'playlist' => 'Playlist',
  'favorites' => 'Favoriten',
  _ => type,
};
