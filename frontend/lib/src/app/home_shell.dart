import 'dart:async';

import 'package:flutter/material.dart';

import '../features/auth/presentation/auth_controller.dart';
import '../features/brain/presentation/brain_screen.dart';
import '../features/devices/presentation/devices_screen.dart';
import '../features/library/presentation/library_screen.dart';
import '../features/player/presentation/audio_player_controller.dart';
import '../features/player/presentation/mini_player.dart';
import '../features/playlists/presentation/playlists_screen.dart';
import '../features/recent/presentation/recent_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/user_data/domain/user_data_models.dart';

final class HomeShell extends StatefulWidget {
  const HomeShell({
    required this.authController,
    required this.audioController,
    super.key,
  });
  final AuthController authController;
  final AudioPlayerController audioController;
  @override
  State<HomeShell> createState() => _HomeShellState();
}

final class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;
  late final _ListeningReporter _reporter;
  int _libraryRevision = 0;
  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.library_music_outlined),
      selectedIcon: Icon(Icons.library_music),
      label: 'Bibliothek',
    ),
    NavigationDestination(
      icon: Icon(Icons.history_outlined),
      selectedIcon: Icon(Icons.history),
      label: 'Zuletzt',
    ),
    NavigationDestination(
      icon: Icon(Icons.queue_music_outlined),
      selectedIcon: Icon(Icons.queue_music),
      label: 'Playlists',
    ),
    NavigationDestination(
      icon: Icon(Icons.devices_outlined),
      selectedIcon: Icon(Icons.devices),
      label: 'Geräte',
    ),
    NavigationDestination(
      icon: Icon(Icons.hub_outlined),
      selectedIcon: Icon(Icons.hub),
      label: 'Brain',
    ),
  ];
  @override
  void initState() {
    super.initState();
    _reporter = _ListeningReporter(
      widget.authController,
      widget.audioController,
    );
  }

  @override
  void dispose() {
    _reporter.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      LibraryScreen(
        key: ValueKey(_libraryRevision),
        authController: widget.authController,
        audioController: widget.audioController,
      ),
      RecentScreen(
        authController: widget.authController,
        audioController: widget.audioController,
      ),
      PlaylistsScreen(
        authController: widget.authController,
        audioController: widget.audioController,
      ),
      DevicesScreen(
        authController: widget.authController,
        audioController: widget.audioController,
      ),
      BrainScreen(authController: widget.authController),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 840;
        final content = IndexedStack(index: _selectedIndex, children: pages);
        return Scaffold(
          appBar: AppBar(
            title: Text(_destinations[_selectedIndex].label),
            actions: [
              IconButton(
                tooltip: 'Einstellungen',
                onPressed: _openSettings,
                icon: const Icon(Icons.settings_outlined),
              ),
              IconButton(
                tooltip: 'Abmelden',
                onPressed: _signOut,
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: wide
              ? Row(
                  children: [
                    NavigationRail(
                      selectedIndex: _selectedIndex,
                      onDestinationSelected: _select,
                      labelType: NavigationRailLabelType.all,
                      destinations: [
                        for (final destination in _destinations)
                          NavigationRailDestination(
                            icon: destination.icon,
                            selectedIcon: destination.selectedIcon,
                            label: Text(destination.label),
                          ),
                      ],
                    ),
                    const VerticalDivider(width: 1),
                    Expanded(child: content),
                  ],
                )
              : content,
          bottomNavigationBar: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              MiniPlayer(
                controller: widget.audioController,
                authController: widget.authController,
              ),
              if (!wide)
                NavigationBar(
                  selectedIndex: _selectedIndex,
                  onDestinationSelected: _select,
                  destinations: _destinations,
                ),
            ],
          ),
        );
      },
    );
  }

  void _select(int index) => setState(() => _selectedIndex = index);

  Future<void> _openSettings() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (settingsContext) => SettingsScreen(
          authController: widget.authController,
          onOpenBrain: () {
            Navigator.of(settingsContext).pop();
            _select(4);
          },
          onArtworkLookupCompleted: () {
            widget.authController.invalidateArtworkCache();
            setState(() => _libraryRevision++);
          },
        ),
      ),
    );
  }

  Future<void> _signOut() async {
    await _reporter.flush();
    await widget.audioController.stop();
    await widget.authController.signOut();
  }
}

final class _ListeningReporter {
  _ListeningReporter(this.auth, this.audio) {
    audio.addListener(_changed);
    _timer = Timer.periodic(const Duration(seconds: 12), (_) => _progress());
    _changed();
  }
  final AuthController auth;
  final AudioPlayerController audio;
  late final Timer _timer;
  String? _trackId;
  bool _wasPlaying = false;
  bool _busy = false;
  void _changed() {
    final nextId = audio.currentTrack?.id;
    if (nextId != _trackId) {
      final previous = _trackId;
      if (previous != null) {
        unawaited(
          _send(previous, ListeningEventType.paused, savePosition: true),
        );
      }
      _trackId = nextId;
      if (nextId != null) unawaited(_send(nextId, ListeningEventType.started));
    } else if (_wasPlaying && !audio.playing && nextId != null) {
      unawaited(_send(nextId, ListeningEventType.paused, savePosition: true));
    }
    _wasPlaying = audio.playing;
  }

  Future<void> _progress() async {
    final id = _trackId;
    if (id == null || !audio.playing || _busy) return;
    await _send(id, ListeningEventType.progress, savePosition: true);
  }

  Future<void> _send(
    String id,
    ListeningEventType type, {
    bool savePosition = false,
  }) async {
    if (auth.status != AuthStatus.signedIn || _busy) return;
    _busy = true;
    final seconds = audio.position.inMilliseconds / 1000;
    try {
      await auth.reportListeningEvent(id, type, positionSeconds: seconds);
      if (savePosition) await auth.saveListeningPosition(id, seconds);
    } catch (_) {
      /* Playback reporting must never interrupt playback. */
    } finally {
      _busy = false;
    }
  }

  Future<void> flush() async {
    final id = _trackId;
    if (id != null) {
      await _send(id, ListeningEventType.paused, savePosition: true);
    }
  }

  void dispose() {
    audio.removeListener(_changed);
    _timer.cancel();
    unawaited(flush());
  }
}
