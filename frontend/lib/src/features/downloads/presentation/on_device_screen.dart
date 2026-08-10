import 'dart:async';

import 'package:flutter/material.dart';

import '../../player/presentation/audio_player_controller.dart';
import '../application/download_controller.dart';
import '../domain/downloaded_track.dart';

final class OnDeviceScreen extends StatefulWidget {
  const OnDeviceScreen({
    required this.downloadController,
    required this.audioController,
    super.key,
  });

  final DownloadController downloadController;
  final AudioPlayerController audioController;

  @override
  State<OnDeviceScreen> createState() => _OnDeviceScreenState();
}

final class _OnDeviceScreenState extends State<OnDeviceScreen> {
  Object? _error;

  @override
  void initState() {
    super.initState();
    widget.downloadController.addListener(_refresh);
    unawaited(_initialize());
  }

  @override
  void dispose() {
    widget.downloadController.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _initialize() async {
    try {
      await widget.downloadController.initialize();
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final downloads = widget.downloadController.downloads;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Downloads', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          const Text(
            'Explizit aus dem Vault geladene Titel für die Offline-Wiedergabe.',
          ),
          const SizedBox(height: 12),
          if (_error case final error?)
            Text('Downloads konnten nicht geladen werden: $error')
          else if (downloads.isEmpty)
            const Card(
              child: ListTile(
                leading: Icon(Icons.download_done_outlined),
                title: Text('Noch keine Downloads'),
                subtitle: Text(
                  'Lade Titel in der Bibliothek auf dieses Gerät.',
                ),
              ),
            )
          else
            for (var index = 0; index < downloads.length; index++)
              _DownloadTile(
                item: downloads[index],
                selected:
                    widget.audioController.currentTrack?.id ==
                    downloads[index].track.id,
                onPlay: () => _play(index),
                onDelete: () => _delete(downloads[index]),
              ),
          const SizedBox(height: 28),
          Text(
            'Lokale Musik',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Card(
            child: ListTile(
              enabled: false,
              leading: Icon(Icons.folder_off_outlined),
              title: Text('Nicht importiert'),
              subtitle: Text(
                'Der Import vorhandener Musikdateien ist für eine zukünftige Phase vorgesehen. Lokale Musik ist nicht dasselbe wie Vault-Downloads.',
              ),
              trailing: Chip(label: Text('Zukünftig')),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _play(int index) async {
    try {
      await widget.audioController.playQueue(
        widget.downloadController.localPlaybackSources(),
        index,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lokale Wiedergabe nicht möglich: $error')),
      );
    }
  }

  Future<void> _delete(DownloadedTrack item) async {
    try {
      if (widget.audioController.currentTrack?.id == item.track.id) {
        await widget.audioController.stop();
      }
      await widget.downloadController.delete(item.track.id);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Download konnte nicht gelöscht werden: $error'),
        ),
      );
    }
  }
}

final class _DownloadTile extends StatelessWidget {
  const _DownloadTile({
    required this.item,
    required this.selected,
    required this.onPlay,
    required this.onDelete,
  });

  final DownloadedTrack item;
  final bool selected;
  final VoidCallback onPlay;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: const CircleAvatar(child: Icon(Icons.download_done)),
    title: Text(item.track.title, maxLines: 1, overflow: TextOverflow.ellipsis),
    subtitle: Text(
      '${item.track.artistLabel} • ${_formatBytes(item.sizeBytes)}',
    ),
    selected: selected,
    onTap: onPlay,
    trailing: IconButton(
      tooltip: 'Download löschen',
      onPressed: onDelete,
      icon: const Icon(Icons.delete_outline),
    ),
  );

  String _formatBytes(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  }
}
