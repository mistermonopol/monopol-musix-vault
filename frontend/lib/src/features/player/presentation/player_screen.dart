import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../library/presentation/track_artwork.dart';
import 'audio_player_controller.dart';

final class PlayerScreen extends StatelessWidget {
  const PlayerScreen({
    required this.controller,
    required this.authController,
    super.key,
  });

  final AudioPlayerController controller;
  final AuthController authController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      final track = controller.currentTrack;
      return Scaffold(
        appBar: AppBar(title: const Text('Aktueller Titel')),
        body: track == null
            ? const Center(child: Text('Aktuell wird kein Titel abgespielt.'))
            : SafeArea(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final artworkSize = (constraints.maxWidth - 48).clamp(
                      180.0,
                      380.0,
                    );
                    return SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 520),
                          child: Column(
                            children: [
                              TrackArtwork(
                                key: ValueKey(track.id),
                                track: track,
                                authController: authController,
                                size: artworkSize,
                              ),
                              const SizedBox(height: 28),
                              Text(
                                track.title,
                                style: Theme.of(
                                  context,
                                ).textTheme.headlineSmall,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                [track.artistLabel, ?track.album].join(' • '),
                                style: Theme.of(context).textTheme.bodyLarge,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 24),
                              _Progress(controller: controller),
                              const SizedBox(height: 12),
                              _Controls(controller: controller),
                              if (controller.errorMessage
                                  case final message?) ...[
                                const SizedBox(height: 20),
                                Text(
                                  'Wiedergabefehler: $message',
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
      );
    },
  );
}

final class _Progress extends StatelessWidget {
  const _Progress({required this.controller});
  final AudioPlayerController controller;

  @override
  Widget build(BuildContext context) {
    final durationMs = controller.duration.inMilliseconds;
    final positionMs = controller.position.inMilliseconds.clamp(
      0,
      durationMs > 0 ? durationMs : 1,
    );
    return Column(
      children: [
        Slider(
          min: 0,
          max: (durationMs > 0 ? durationMs : 1).toDouble(),
          value: positionMs.toDouble(),
          onChanged: durationMs > 0
              ? (value) =>
                    controller.seek(Duration(milliseconds: value.round()))
              : null,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_format(controller.position)),
              Text(_format(controller.duration)),
            ],
          ),
        ),
      ],
    );
  }

  String _format(Duration value) {
    final minutes = value.inMinutes;
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

final class _Controls extends StatelessWidget {
  const _Controls({required this.controller});
  final AudioPlayerController controller;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final repeatLabel = switch (controller.repeatMode) {
      PlaybackRepeatMode.off => 'Repeat aus',
      PlaybackRepeatMode.all => 'Alle Titel wiederholen',
      PlaybackRepeatMode.one => 'Diesen Titel wiederholen',
    };
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton(
          tooltip: controller.shuffleEnabled
              ? 'Shuffle ausschalten'
              : 'Shuffle einschalten',
          color: controller.shuffleEnabled ? colors.primary : null,
          onPressed: controller.queueLength > 1
              ? controller.toggleShuffle
              : null,
          icon: const Icon(Icons.shuffle),
        ),
        IconButton(
          tooltip: 'Vorheriger Titel',
          iconSize: 36,
          onPressed: controller.hasPrevious ? controller.previous : null,
          icon: const Icon(Icons.skip_previous),
        ),
        IconButton.filled(
          tooltip: controller.playing ? 'Pause' : 'Abspielen',
          iconSize: 42,
          padding: const EdgeInsets.all(16),
          onPressed: controller.playOrPause,
          icon: controller.buffering
              ? const SizedBox.square(
                  dimension: 32,
                  child: CircularProgressIndicator(strokeWidth: 3),
                )
              : Icon(controller.playing ? Icons.pause : Icons.play_arrow),
        ),
        IconButton(
          tooltip: 'Nächster Titel',
          iconSize: 36,
          onPressed: controller.hasNext ? controller.next : null,
          icon: const Icon(Icons.skip_next),
        ),
        IconButton(
          tooltip: repeatLabel,
          color: controller.repeatMode == PlaybackRepeatMode.off
              ? null
              : colors.primary,
          onPressed: controller.cycleRepeatMode,
          icon: Icon(
            controller.repeatMode == PlaybackRepeatMode.one
                ? Icons.repeat_one
                : Icons.repeat,
          ),
        ),
      ],
    );
  }
}
