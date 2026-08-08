import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../library/domain/catalog_track.dart';
import '../../library/presentation/track_artwork.dart';
import '../../player/presentation/audio_player_controller.dart';
import '../../user_data/domain/user_data_models.dart';

final class PlaylistsScreen extends StatefulWidget {
  const PlaylistsScreen({
    required this.authController,
    required this.audioController,
    super.key,
  });
  final AuthController authController;
  final AudioPlayerController audioController;
  @override
  State<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

final class _PlaylistsScreenState extends State<PlaylistsScreen> {
  List<VaultPlaylist> _items = const [];
  List<CatalogTrack> _tracks = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      _content(),
      Positioned(
        right: 18,
        bottom: 18,
        child: FloatingActionButton.extended(
          onPressed: _editMetadata,
          icon: const Icon(Icons.add),
          label: const Text('Playlist'),
        ),
      ),
    ],
  );

  Widget _content() {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error case final error?) return Center(child: Text(error));
    if (_items.isEmpty) {
      return const Center(child: Text('Noch keine Playlists.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 88),
        itemCount: _items.length,
        itemBuilder: (context, index) {
          final playlist = _items[index];
          return Card(
            child: ExpansionTile(
              leading: const Icon(Icons.queue_music),
              title: Text(playlist.name),
              subtitle: Text(
                '${playlist.items.length} Titel${playlist.description.isEmpty ? '' : ' • ${playlist.description}'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              children: [
                if (playlist.items.isEmpty)
                  const ListTile(title: Text('Diese Playlist ist leer.')),
                for (final item in playlist.items)
                  ListTile(
                    dense: true,
                    leading: _playlistArtwork(item),
                    title: Text(_track(item.trackId)?.title ?? item.trackId),
                    subtitle: Text(
                      _track(item.trackId)?.artistLabel ??
                          'Titel nicht im aktuellen Katalog',
                    ),
                  ),
                OverflowBar(
                  children: [
                    TextButton.icon(
                      onPressed: () => _editMetadata(playlist),
                      icon: const Icon(Icons.edit),
                      label: const Text('Bearbeiten'),
                    ),
                    TextButton.icon(
                      onPressed: () => _editItems(playlist),
                      icon: const Icon(Icons.playlist_add),
                      label: const Text('Titel'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: playlist.items.isEmpty
                          ? null
                          : () => _play(playlist),
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Abspielen'),
                    ),
                    IconButton(
                      tooltip: 'Löschen',
                      onPressed: () => _delete(playlist),
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _playlistArtwork(VaultPlaylistItem item) {
    final track = _track(item.trackId);
    return track == null
        ? Text('${item.position + 1}')
        : TrackArtwork(
            track: track,
            authController: widget.authController,
            size: 40,
          );
  }

  CatalogTrack? _track(String id) {
    for (final track in _tracks) {
      if (track.id == id) return track;
    }
    return null;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final values = await Future.wait<Object>([
        widget.authController.listPlaylists(),
        widget.authController.listTracks(),
      ]);
      if (!mounted) return;
      setState(() {
        _items = values[0] as List<VaultPlaylist>;
        _tracks = (values[1] as CatalogPage).items;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _editMetadata([VaultPlaylist? playlist]) async {
    final name = TextEditingController(text: playlist?.name);
    final description = TextEditingController(text: playlist?.description);
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          playlist == null ? 'Playlist erstellen' : 'Playlist bearbeiten',
        ),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: description,
                decoration: const InputDecoration(labelText: 'Beschreibung'),
                maxLines: 3,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Speichern'),
          ),
        ],
      ),
    );
    if (save != true || name.text.trim().isEmpty) return;
    try {
      if (playlist == null) {
        await widget.authController.createPlaylist(
          name.text.trim(),
          description.text.trim(),
        );
      } else {
        await widget.authController.updatePlaylist(
          playlist.id,
          name.text.trim(),
          description.text.trim(),
        );
      }
      await _load();
    } catch (error) {
      _show(error);
    }
  }

  Future<void> _editItems(VaultPlaylist playlist) async {
    final selected = playlist.items.map((item) => item.trackId).toSet();
    final result = await showDialog<Set<String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Titel – ${playlist.name}'),
          content: SizedBox(
            width: 520,
            height: 480,
            child: ListView.builder(
              itemCount: _tracks.length,
              itemBuilder: (context, index) {
                final track = _tracks[index];
                return CheckboxListTile(
                  value: selected.contains(track.id),
                  secondary: TrackArtwork(
                    track: track,
                    authController: widget.authController,
                    size: 40,
                  ),
                  title: Text(track.title),
                  subtitle: Text(track.artistLabel),
                  onChanged: (value) => setDialogState(() {
                    value == true
                        ? selected.add(track.id)
                        : selected.remove(track.id);
                  }),
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, selected),
              child: const Text('Übernehmen'),
            ),
          ],
        ),
      ),
    );
    if (result == null) return;
    try {
      await widget.authController.replacePlaylistItems(
        playlist.id,
        _tracks
            .where((track) => result.contains(track.id))
            .map((track) => track.id)
            .toList(),
      );
      await _load();
    } catch (error) {
      _show(error);
    }
  }

  Future<void> _delete(VaultPlaylist playlist) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Playlist löschen?'),
        content: Text('„${playlist.name}“ wird dauerhaft gelöscht.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.authController.deletePlaylist(playlist.id);
      await _load();
    } catch (error) {
      _show(error);
    }
  }

  Future<void> _play(VaultPlaylist playlist) async {
    final tracks = playlist.items
        .map((item) => _track(item.trackId))
        .whereType<CatalogTrack>()
        .toList();
    if (tracks.isNotEmpty) {
      await widget.audioController.playQueue(
        widget.authController.playbackSources(tracks),
        0,
      );
    }
  }

  void _show(Object error) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}
