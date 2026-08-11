import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:media_kit/media_kit.dart';

import '../../library/domain/catalog_track.dart';
import '../domain/playback_source.dart';

enum PlaybackRepeatMode { off, all, one }

final class AudioPlayerController extends ChangeNotifier {
  AudioPlayerController({Player? player}) : _player = player ?? Player() {
    _subscriptions.addAll([
      _player.stream.playing.listen((_) => notifyListeners()),
      _player.stream.position.listen((_) => notifyListeners()),
      _player.stream.duration.listen((_) => notifyListeners()),
      _player.stream.buffering.listen((_) => notifyListeners()),
      _player.stream.playlist.listen((state) {
        final mappedQueue = state.medias
            .map((media) => _trackByUri[media.uri])
            .whereType<CatalogTrack>()
            .toList(growable: false);
        if (mappedQueue.length == state.medias.length) {
          _queue = mappedQueue;
        }
        final index = state.index;
        _currentTrack = index >= 0 && index < _queue.length
            ? _queue[index]
            : null;
        notifyListeners();
      }),
      _player.stream.error.listen((message) {
        errorMessage = message;
        notifyListeners();
      }),
    ]);
  }

  final Player _player;
  final List<StreamSubscription<Object?>> _subscriptions = [];
  List<CatalogTrack> _queue = const [];
  final Map<String, CatalogTrack> _trackByUri = {};
  CatalogTrack? _currentTrack;
  bool _shuffleEnabled = false;
  PlaybackRepeatMode _repeatMode = PlaybackRepeatMode.off;
  String? errorMessage;

  CatalogTrack? get currentTrack => _currentTrack;
  bool get playing => _player.state.playing;
  bool get buffering => _player.state.buffering;
  Duration get position => _player.state.position;
  Duration get duration => _player.state.duration;
  bool get shuffleEnabled => _shuffleEnabled;
  PlaybackRepeatMode get repeatMode => _repeatMode;
  int get queueLength => _queue.length;
  List<String> get queueTrackIds =>
      _queue.map((track) => track.id).toList(growable: false);
  int? get currentIndex {
    final index = _player.state.playlist.index;
    return index >= 0 && index < _queue.length ? index : null;
  }

  bool get hasPrevious => _player.state.playlist.index > 0;
  bool get hasNext {
    final index = _player.state.playlist.index;
    return index >= 0 && index < _queue.length - 1;
  }

  Future<void> playQueue(List<PlaybackSource> sources, int index) async {
    if (sources.isEmpty || index < 0 || index >= sources.length) return;
    errorMessage = null;
    _queue = sources.map((source) => source.track).toList(growable: false);
    _trackByUri
      ..clear()
      ..addEntries(
        sources.map((source) => MapEntry(source.uri.toString(), source.track)),
      );
    _currentTrack = _queue[index];
    notifyListeners();
    await _player.open(
      Playlist(
        sources
            .map(
              (source) =>
                  Media(source.uri.toString(), httpHeaders: source.headers),
            )
            .toList(growable: false),
        index: index,
      ),
    );
  }

  Future<void> playOrPause() => _player.playOrPause();
  Future<void> play() => _player.play();
  Future<void> pause() => _player.pause();
  Future<void> seek(Duration position) => _player.seek(position);
  Future<void> setVolume(double volume) => _player.setVolume(volume * 100);

  Future<void> toggleShuffle() => setShuffleEnabled(!_shuffleEnabled);

  Future<void> setShuffleEnabled(bool enabled) async {
    if (_shuffleEnabled == enabled) return;
    _shuffleEnabled = enabled;
    await _player.setShuffle(enabled);
    notifyListeners();
  }

  Future<void> cycleRepeatMode() => setRepeatMode(switch (_repeatMode) {
    PlaybackRepeatMode.off => PlaybackRepeatMode.all,
    PlaybackRepeatMode.all => PlaybackRepeatMode.one,
    PlaybackRepeatMode.one => PlaybackRepeatMode.off,
  });

  Future<void> setRepeatMode(PlaybackRepeatMode mode) async {
    if (_repeatMode == mode) return;
    _repeatMode = mode;
    await _player.setPlaylistMode(switch (_repeatMode) {
      PlaybackRepeatMode.off => PlaylistMode.none,
      PlaybackRepeatMode.all => PlaylistMode.loop,
      PlaybackRepeatMode.one => PlaylistMode.single,
    });
    notifyListeners();
  }

  Future<void> previous() => hasPrevious ? _player.previous() : Future.value();
  Future<void> next() => hasNext ? _player.next() : Future.value();

  Future<void> stop() async {
    await _player.stop();
    await _player.setShuffle(false);
    await _player.setPlaylistMode(PlaylistMode.none);
    _queue = const [];
    _trackByUri.clear();
    _currentTrack = null;
    errorMessage = null;
    _shuffleEnabled = false;
    _repeatMode = PlaybackRepeatMode.off;
    notifyListeners();
  }

  @override
  void dispose() {
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    unawaited(_player.dispose());
    super.dispose();
  }
}
