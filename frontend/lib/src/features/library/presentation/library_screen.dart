import 'dart:async';

import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../domain/catalog_track.dart';
import '../../player/presentation/audio_player_controller.dart';
import '../../player/presentation/mini_player.dart';

final class LibraryScreen extends StatefulWidget {
  const LibraryScreen({
    required this.authController,
    required this.audioController,
    super.key,
  });

  final AuthController authController;
  final AudioPlayerController audioController;

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

final class _LibraryScreenState extends State<LibraryScreen> {
  final _searchController = TextEditingController();
  Timer? _searchTimer;
  List<CatalogTrack> _tracks = const [];
  int _total = 0;
  bool _loading = true;
  String? _error;
  Set<String> _favoriteIds = {};
  Set<String> _updatingFavoriteIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Musix Vault'),
      actions: [
        IconButton(
          tooltip: 'Aktualisieren',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          tooltip: 'Abmelden',
          onPressed: _signOut,
          icon: const Icon(Icons.logout),
        ),
      ],
    ),
    bottomNavigationBar: MiniPlayer(controller: widget.audioController),
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SearchBar(
              controller: _searchController,
              hintText: 'Titel, Künstler oder Album suchen',
              leading: const Icon(Icons.search),
              trailing: [
                if (_searchController.text.isNotEmpty)
                  IconButton(
                    tooltip: 'Suche löschen',
                    onPressed: () {
                      _searchController.clear();
                      _load();
                    },
                    icon: const Icon(Icons.close),
                  ),
              ],
              onChanged: (_) {
                setState(() {});
                _searchTimer?.cancel();
                _searchTimer = Timer(const Duration(milliseconds: 350), _load);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '$_total Titel',
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ),
          ),
          Expanded(child: _content()),
        ],
      ),
    ),
  );

  Widget _content() {
    if (_loading && _tracks.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error case final message?) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 52),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Erneut versuchen'),
              ),
            ],
          ),
        ),
      );
    }
    if (_tracks.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.library_music_outlined, size: 64),
              SizedBox(height: 14),
              Text('Keine Musik gefunden.'),
              SizedBox(height: 6),
              Text(
                'Scanne zuerst deine Musikbibliothek im Web-Player.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        itemCount: _tracks.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final track = _tracks[index];
          return ListTile(
            leading: const SizedBox.square(
              dimension: 48,
              child: Card(child: Icon(Icons.music_note)),
            ),
            title: Text(
              track.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              [track.artistLabel, ?track.album].join(' • '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_formatDuration(track.durationSeconds)),
                IconButton(
                  tooltip: _favoriteIds.contains(track.id)
                      ? 'Aus Favoriten entfernen'
                      : 'Zu Favoriten hinzufügen',
                  onPressed: _updatingFavoriteIds.contains(track.id)
                      ? null
                      : () => _toggleFavorite(track),
                  icon: Icon(
                    _favoriteIds.contains(track.id)
                        ? Icons.favorite
                        : Icons.favorite_border,
                    color: _favoriteIds.contains(track.id)
                        ? Colors.pinkAccent
                        : null,
                  ),
                ),
              ],
            ),
            selected: widget.audioController.currentTrack?.id == track.id,
            onTap: () => _play(index),
          );
        },
      ),
    );
  }

  Future<void> _toggleFavorite(CatalogTrack track) async {
    final nextFavorite = !_favoriteIds.contains(track.id);
    setState(() {
      _updatingFavoriteIds = {..._updatingFavoriteIds, track.id};
      if (nextFavorite) {
        _favoriteIds = {..._favoriteIds, track.id};
      } else {
        _favoriteIds = {..._favoriteIds}..remove(track.id);
      }
    });
    try {
      await widget.authController.setTrackFavorite(
        track.id,
        favorite: nextFavorite,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        if (nextFavorite) {
          _favoriteIds = {..._favoriteIds}..remove(track.id);
        } else {
          _favoriteIds = {..._favoriteIds, track.id};
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Favorit konnte nicht gespeichert werden: $error'),
        ),
      );
    } finally {
      if (mounted) {
        setState(
          () =>
              _updatingFavoriteIds = {..._updatingFavoriteIds}
                ..remove(track.id),
        );
      }
    }
  }

  Future<void> _play(int index) async {
    try {
      final sources = widget.authController.playbackSources(_tracks);
      await widget.audioController.playQueue(sources, index);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Wiedergabe nicht möglich: $error')),
      );
    }
  }

  Future<void> _signOut() async {
    await widget.audioController.stop();
    await widget.authController.signOut();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>([
        widget.authController.listTracks(search: _searchController.text),
        widget.authController.listFavoriteTrackIds(),
      ]);
      if (!mounted) return;
      final page = results[0] as CatalogPage;
      final favoriteIds = results[1] as Set<String>;
      setState(() {
        _tracks = page.items;
        _total = page.total;
        _favoriteIds = favoriteIds;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDuration(double? seconds) {
    if (seconds == null) return '';
    final duration = Duration(seconds: seconds.round());
    final minutes = duration.inMinutes;
    final remainder = duration.inSeconds
        .remainder(60)
        .toString()
        .padLeft(2, '0');
    return '$minutes:$remainder';
  }
}
