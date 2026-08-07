import 'dart:async';

import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../domain/catalog_track.dart';

final class LibraryScreen extends StatefulWidget {
  const LibraryScreen({required this.authController, super.key});

  final AuthController authController;

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
          onPressed: widget.authController.signOut,
          icon: const Icon(Icons.logout),
        ),
      ],
    ),
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
            trailing: Text(_formatDuration(track.durationSeconds)),
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Der Audio-Player folgt als nächster Schritt.'),
              ),
            ),
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
      final page = await widget.authController.listTracks(
        search: _searchController.text,
      );
      if (!mounted) return;
      setState(() {
        _tracks = page.items;
        _total = page.total;
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
