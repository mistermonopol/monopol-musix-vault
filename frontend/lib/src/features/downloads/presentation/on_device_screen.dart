import 'dart:async';

import 'package:flutter/material.dart';

import '../../local_music/application/local_music_controller.dart';
import '../../local_music/domain/local_music_track.dart';
import '../../player/presentation/audio_player_controller.dart';
import '../application/download_controller.dart';
import '../domain/downloaded_track.dart';

final class OnDeviceScreen extends StatefulWidget {
  const OnDeviceScreen({
    required this.downloadController,
    required this.localMusicController,
    required this.audioController,
    super.key,
  });

  final DownloadController downloadController;
  final LocalMusicController localMusicController;
  final AudioPlayerController audioController;

  @override
  State<OnDeviceScreen> createState() => _OnDeviceScreenState();
}

final class _OnDeviceScreenState extends State<OnDeviceScreen> {
  Object? _downloadError;

  @override
  void initState() {
    super.initState();
    widget.downloadController.addListener(_refresh);
    widget.localMusicController.addListener(_refresh);
    unawaited(_initializeDownloads());
  }

  @override
  void dispose() {
    widget.downloadController.removeListener(_refresh);
    widget.localMusicController.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _initializeDownloads() async {
    try {
      await widget.downloadController.initialize();
    } catch (error) {
      if (mounted) setState(() => _downloadError = error);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.download_done), text: 'Downloads'),
              Tab(icon: Icon(Icons.audio_file_outlined), text: 'Lokale Musik'),
            ],
          ),
          Expanded(child: TabBarView(children: [_downloads(), _localMusic()])),
        ],
      ),
    ),
  );

  Widget _downloads() {
    final downloads = widget.downloadController.downloads;
    if (_downloadError case final error?) {
      return _MessageView(
        icon: Icons.error_outline,
        title: 'Downloads konnten nicht geladen werden',
        message: '$error',
      );
    }
    if (downloads.isEmpty) {
      return const _MessageView(
        icon: Icons.download_for_offline_outlined,
        title: 'Noch keine Downloads',
        message:
            'Lade Titel in der Bibliothek herunter, um sie ohne Internet abzuspielen.',
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
      itemCount: downloads.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final item = downloads[index];
        return ListTile(
          leading: const CircleAvatar(child: Icon(Icons.download_done)),
          title: Text(
            item.track.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Text(
            '${item.track.artistLabel} • ${_formatBytes(item.sizeBytes)}',
          ),
          selected: widget.audioController.currentTrack?.id == item.track.id,
          onTap: () => _playDownloads(index),
          trailing: IconButton(
            tooltip: 'Download löschen',
            onPressed: () => _delete(item),
            icon: const Icon(Icons.delete_outline),
          ),
        );
      },
    );
  }

  Widget _localMusic() {
    final controller = widget.localMusicController;
    if (controller.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (controller.access == LocalMusicAccess.unknown) {
      return _MessageView(
        icon: Icons.library_music_outlined,
        title: 'Musik auf diesem Gerät',
        message:
            'Durchsuche Androids Mediathek nach vorhandenen Audiodateien. Vault-Downloads bleiben separat.',
        action: FilledButton.icon(
          onPressed: controller.load,
          icon: const Icon(Icons.folder_open),
          label: const Text('Lokale Musik anzeigen'),
        ),
      );
    }
    if (controller.access == LocalMusicAccess.denied) {
      return _MessageView(
        icon: Icons.no_accounts_outlined,
        title: 'Zugriff nicht erlaubt',
        message:
            controller.errorMessage ??
            'Erlaube den Zugriff auf Musik und Audio in den Android-Einstellungen.',
        action: OutlinedButton.icon(
          onPressed: controller.load,
          icon: const Icon(Icons.refresh),
          label: const Text('Erneut versuchen'),
        ),
      );
    }
    if (controller.access == LocalMusicAccess.unsupported) {
      return _MessageView(
        icon: Icons.phone_android_outlined,
        title: 'Nur auf Android verfügbar',
        message:
            controller.errorMessage ??
            'Die lokale Mediathek wird auf dieser Plattform noch nicht unterstützt.',
      );
    }
    if (controller.tracks.isEmpty) {
      return _MessageView(
        icon: Icons.audio_file_outlined,
        title: 'Keine lokale Musik gefunden',
        message: 'Androids Mediathek enthält aktuell keine Musikdateien.',
        action: OutlinedButton.icon(
          onPressed: controller.load,
          icon: const Icon(Icons.refresh),
          label: const Text('Neu einlesen'),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: controller.load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        itemCount: controller.tracks.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final item = controller.tracks[index];
          return _LocalTrackTile(
            item: item,
            selected: widget.audioController.currentTrack?.id == item.track.id,
            preparing:
                widget.localMusicController.preparingTrackId == item.track.id,
            onPlay: widget.localMusicController.preparingTrackId == null
                ? () => _playLocal(index)
                : null,
          );
        },
      ),
    );
  }

  Future<void> _playDownloads(int index) => widget.audioController.playQueue(
    widget.downloadController.localPlaybackSources(),
    index,
  );

  Future<void> _playLocal(int index) async {
    try {
      final item = widget.localMusicController.tracks[index];
      final source = await widget.localMusicController.preparePlayback(item);
      await widget.audioController.playQueue([source], 0);
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

  String _formatBytes(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  }
}

final class _LocalTrackTile extends StatelessWidget {
  const _LocalTrackTile({
    required this.item,
    required this.selected,
    required this.preparing,
    required this.onPlay,
  });
  final LocalMusicTrack item;
  final bool selected;
  final bool preparing;
  final VoidCallback? onPlay;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: const CircleAvatar(child: Icon(Icons.audio_file)),
    title: Text(item.track.title, maxLines: 1, overflow: TextOverflow.ellipsis),
    subtitle: Text(
      [item.track.artistLabel, ?item.track.album].join(' • '),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    ),
    trailing: preparing
        ? const SizedBox.square(
            dimension: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : const Chip(label: Text('Lokal')),
    selected: selected,
    onTap: onPlay,
  );
}

final class _MessageView extends StatelessWidget {
  const _MessageView({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });
  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 64),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    ),
  );
}
