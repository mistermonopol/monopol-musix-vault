import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../library/domain/catalog_track.dart';
import '../../player/presentation/audio_player_controller.dart';
import '../../user_data/domain/user_data_models.dart';

final class RecentScreen extends StatefulWidget {
  const RecentScreen({
    required this.authController,
    required this.audioController,
    super.key,
  });

  final AuthController authController;
  final AudioPlayerController audioController;

  @override
  State<RecentScreen> createState() => _RecentScreenState();
}

final class _RecentScreenState extends State<RecentScreen> {
  List<RecentListeningItem> _items = const [];
  Map<String, CatalogTrack> _tracks = const {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error case final error?) {
      return _Message(
        icon: Icons.history_toggle_off,
        message: error,
        onRetry: _load,
      );
    }
    if (_items.isEmpty) {
      return const _Message(
        icon: Icons.history,
        message: 'Noch keine Wiedergaben vorhanden.',
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final item = _items[index];
          final track = _tracks[item.trackId];
          return ListTile(
            leading: const Icon(Icons.history),
            title: Text(
              track?.title ?? 'Titel ${item.trackId.substring(0, 8)}',
            ),
            subtitle: Text(
              '${track?.artistLabel ?? item.eventType.name} • ${_time(item.occurredAt)}',
            ),
            trailing: Text(_duration(item.positionSeconds)),
            onTap: track == null ? null : () => _play(track),
          );
        },
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>([
        widget.authController.listRecent(),
        widget.authController.listTracks(),
      ]);
      if (!mounted) return;
      final page = results[1] as CatalogPage;
      setState(() {
        _items = results[0] as List<RecentListeningItem>;
        _tracks = {for (final track in page.items) track.id: track};
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _play(CatalogTrack track) async {
    await widget.audioController.playQueue(
      widget.authController.playbackSources([track]),
      0,
    );
  }

  String _time(DateTime value) {
    final local = value.toLocal();
    return '${local.day.toString().padLeft(2, '0')}.${local.month.toString().padLeft(2, '0')} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String _duration(double seconds) =>
      '${seconds ~/ 60}:${(seconds.round() % 60).toString().padLeft(2, '0')}';
}

final class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.message, this.onRetry});
  final IconData icon;
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Erneut versuchen'),
            ),
          ],
        ],
      ),
    ),
  );
}
