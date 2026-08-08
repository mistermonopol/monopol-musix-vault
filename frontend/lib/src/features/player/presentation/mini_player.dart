import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../library/presentation/track_artwork.dart';
import 'audio_player_controller.dart';

final class MiniPlayer extends StatelessWidget {
  const MiniPlayer({
    required this.controller,
    required this.authController,
    super.key,
  });

  final AudioPlayerController controller;
  final AuthController authController;

  @override
  Widget build(BuildContext context) {
    final track = controller.currentTrack;
    if (track == null) return const SizedBox.shrink();
    final durationMs = controller.duration.inMilliseconds;
    final positionMs = controller.position.inMilliseconds.clamp(
      0,
      durationMs > 0 ? durationMs : 1,
    );
    return Material(
      elevation: 12,
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Row(
                children: [
                  TrackArtwork(
                    track: track,
                    authController: authController,
                    size: 46,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          track.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          track.artistLabel,
                          style: Theme.of(context).textTheme.bodySmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Zurück',
                    onPressed: controller.hasPrevious
                        ? controller.previous
                        : null,
                    icon: const Icon(Icons.skip_previous),
                  ),
                  IconButton.filled(
                    tooltip: controller.playing ? 'Pause' : 'Abspielen',
                    onPressed: controller.playOrPause,
                    icon: controller.buffering
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            controller.playing ? Icons.pause : Icons.play_arrow,
                          ),
                  ),
                  IconButton(
                    tooltip: 'Weiter',
                    onPressed: controller.hasNext ? controller.next : null,
                    icon: const Icon(Icons.skip_next),
                  ),
                ],
              ),
            ),
            if (controller.errorMessage case final message?)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  'Wiedergabefehler: $message',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
