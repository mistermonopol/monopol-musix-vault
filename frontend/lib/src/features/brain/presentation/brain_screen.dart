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
  bool _loading = true;
  String? _error;
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
            Text(error),
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
    if (graph.nodes.isEmpty) {
      return const Center(child: Text('Der Brain-Graph ist leer.'));
    }
    final visibleNodes = graph.nodes.take(120).toList();
    final ids = visibleNodes.map((node) => node.id).toSet();
    final visibleEdges = graph.edges
        .where((edge) => ids.contains(edge.source) && ids.contains(edge.target))
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${graph.nodes.length} Knoten • ${graph.edges.length} Verbindungen${graph.nodes.length > visibleNodes.length ? ' • erste ${visibleNodes.length} angezeigt' : ''}',
                ),
              ),
              IconButton(
                onPressed: _load,
                tooltip: 'Aktualisieren',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        Expanded(
          child: InteractiveViewer(
            minScale: .25,
            maxScale: 4,
            boundaryMargin: const EdgeInsets.all(800),
            constrained: false,
            child: CustomPaint(
              size: const Size(1200, 900),
              painter: _GraphPainter(
                visibleNodes,
                visibleEdges,
                Theme.of(context).colorScheme,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final graph = await widget.authController.getBrainGraph();
      if (mounted) setState(() => _graph = graph);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

final class _GraphPainter extends CustomPainter {
  _GraphPainter(this.nodes, this.edges, this.colors);
  final List<BrainNode> nodes;
  final List<BrainEdge> edges;
  final ColorScheme colors;
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) * .4;
    final points = <String, Offset>{};
    for (var i = 0; i < nodes.length; i++) {
      final ring = 1 + i ~/ 30;
      final ringIndex = i % 30;
      final count = math.min(30, nodes.length - (ring - 1) * 30);
      final angle = -math.pi / 2 + 2 * math.pi * ringIndex / count;
      points[nodes[i].id] =
          center +
          Offset(math.cos(angle), math.sin(angle)) * (radius * ring / 4);
    }
    final edgePaint = Paint()
      ..color = colors.outlineVariant.withValues(alpha: .55)
      ..strokeWidth = 1;
    for (final edge in edges) {
      final source = points[edge.source];
      final target = points[edge.target];
      if (source != null && target != null) {
        canvas.drawLine(source, target, edgePaint);
      }
    }
    for (final node in nodes) {
      final point = points[node.id]!;
      final color = _color(node.type);
      canvas.drawCircle(
        point,
        node.type == 'track' ? 8 : 11,
        Paint()..color = color,
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
      )..layout(maxWidth: 100);
      label.paint(canvas, point + Offset(-label.width / 2, 13));
    }
  }

  Color _color(String type) => switch (type) {
    'artist' => colors.primary,
    'album' => colors.tertiary,
    'genre' => colors.secondary,
    _ => colors.onSurfaceVariant,
  };
  @override
  bool shouldRepaint(covariant _GraphPainter oldDelegate) =>
      oldDelegate.nodes != nodes ||
      oldDelegate.edges != edges ||
      oldDelegate.colors != colors;
}
