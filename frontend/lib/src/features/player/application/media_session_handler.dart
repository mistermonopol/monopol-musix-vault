import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';

import '../presentation/audio_player_controller.dart';

final class VaultMediaSessionHandler extends BaseAudioHandler
    with QueueHandler, SeekHandler {
  AudioPlayerController? _controller;
  Timer? _positionTimer;
  StreamSubscription<AudioInterruptionEvent>? _interruptionSubscription;
  bool _resumeAfterInterruption = false;
  String? _lastTrackId;
  bool? _lastPlaying;

  Future<void> attach(AudioPlayerController controller) async {
    _controller = controller;
    controller.addListener(_playerChanged);
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());
    _interruptionSubscription = session.interruptionEventStream.listen(
      _handleInterruption,
    );
    _positionTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _publishState(),
    );
    _publishMetadata();
    _publishState();
  }

  void _playerChanged() {
    final controller = _controller;
    if (controller == null) return;
    final trackChanged = controller.currentTrack?.id != _lastTrackId;
    final playingChanged = controller.playing != _lastPlaying;
    if (trackChanged) _publishMetadata();
    if (trackChanged || playingChanged) _publishState();
  }

  void _publishMetadata() {
    final controller = _controller;
    final track = controller?.currentTrack;
    _lastTrackId = track?.id;
    if (track == null) {
      mediaItem.add(null);
      queue.add(const []);
      return;
    }
    mediaItem.add(
      MediaItem(
        id: track.id,
        title: track.title,
        artist: track.artistLabel,
        album: track.album,
        duration: track.durationSeconds == null
            ? null
            : Duration(milliseconds: (track.durationSeconds! * 1000).round()),
      ),
    );
  }

  void _publishState() {
    final controller = _controller;
    if (controller == null) return;
    _lastPlaying = controller.playing;
    playbackState.add(
      PlaybackState(
        controls: [
          MediaControl.skipToPrevious,
          controller.playing ? MediaControl.pause : MediaControl.play,
          MediaControl.skipToNext,
          MediaControl.stop,
        ],
        systemActions: const {
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
          MediaAction.playPause,
        },
        androidCompactActionIndices: const [0, 1, 2],
        processingState: controller.currentTrack == null
            ? AudioProcessingState.idle
            : controller.buffering
            ? AudioProcessingState.buffering
            : AudioProcessingState.ready,
        playing: controller.playing,
        updatePosition: controller.position,
        bufferedPosition: controller.position,
        speed: 1,
        queueIndex: controller.currentIndex,
        repeatMode: switch (controller.repeatMode) {
          PlaybackRepeatMode.off => AudioServiceRepeatMode.none,
          PlaybackRepeatMode.all => AudioServiceRepeatMode.all,
          PlaybackRepeatMode.one => AudioServiceRepeatMode.one,
        },
        shuffleMode: controller.shuffleEnabled
            ? AudioServiceShuffleMode.all
            : AudioServiceShuffleMode.none,
      ),
    );
  }

  void _handleInterruption(AudioInterruptionEvent event) {
    final controller = _controller;
    if (controller == null) return;
    if (event.begin) {
      _resumeAfterInterruption = controller.playing;
      if (event.type == AudioInterruptionType.duck) {
        unawaited(controller.setVolume(0.3));
      } else if (controller.playing) {
        unawaited(controller.pause());
      }
      return;
    }
    if (event.type == AudioInterruptionType.duck) {
      unawaited(controller.setVolume(1));
    } else if (_resumeAfterInterruption) {
      unawaited(controller.play());
    }
    _resumeAfterInterruption = false;
  }

  @override
  Future<void> play() => _controller?.play() ?? Future.value();

  @override
  Future<void> pause() => _controller?.pause() ?? Future.value();

  @override
  Future<void> stop() async {
    await _controller?.stop();
    await super.stop();
  }

  @override
  Future<void> seek(Duration position) =>
      _controller?.seek(position) ?? Future.value();

  @override
  Future<void> skipToPrevious() => _controller?.previous() ?? Future.value();

  @override
  Future<void> skipToNext() => _controller?.next() ?? Future.value();

  @override
  Future<void> setRepeatMode(AudioServiceRepeatMode repeatMode) async {
    final controller = _controller;
    if (controller == null) return;
    await controller.setRepeatMode(switch (repeatMode) {
      AudioServiceRepeatMode.one => PlaybackRepeatMode.one,
      AudioServiceRepeatMode.all ||
      AudioServiceRepeatMode.group => PlaybackRepeatMode.all,
      _ => PlaybackRepeatMode.off,
    });
  }

  @override
  Future<void> setShuffleMode(AudioServiceShuffleMode shuffleMode) =>
      _controller?.setShuffleEnabled(
        shuffleMode != AudioServiceShuffleMode.none,
      ) ??
      Future.value();

  Future<void> close() async {
    final controller = _controller;
    if (controller != null) controller.removeListener(_playerChanged);
    _controller = null;
    _positionTimer?.cancel();
    await _interruptionSubscription?.cancel();
  }
}
