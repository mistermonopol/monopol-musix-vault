import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../domain/catalog_track.dart';

final class TrackArtwork extends StatefulWidget {
  const TrackArtwork({
    required this.track,
    required this.authController,
    this.size = 48,
    super.key,
  });

  final CatalogTrack track;
  final AuthController authController;
  final double size;

  @override
  State<TrackArtwork> createState() => _TrackArtworkState();
}

final class _TrackArtworkState extends State<TrackArtwork> {
  Future<Uint8List?>? _artwork;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant TrackArtwork oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.track.id != widget.track.id ||
        oldWidget.track.hasArtwork != widget.track.hasArtwork ||
        oldWidget.authController != widget.authController) {
      _load();
    }
  }

  void _load() {
    _artwork = widget.track.hasArtwork
        ? widget.authController.trackArtwork(widget.track)
        : null;
  }

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: widget.size,
    child: ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: _artwork == null
          ? _ArtworkFallback(track: widget.track)
          : FutureBuilder<Uint8List?>(
              future: _artwork,
              builder: (context, snapshot) {
                final bytes = snapshot.data;
                if (bytes == null || snapshot.hasError) {
                  return _ArtworkFallback(track: widget.track);
                }
                return Image.memory(
                  bytes,
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  errorBuilder: (_, _, _) =>
                      _ArtworkFallback(track: widget.track),
                );
              },
            ),
    ),
  );
}

final class _ArtworkFallback extends StatelessWidget {
  const _ArtworkFallback({required this.track});

  final CatalogTrack track;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final hue = track.id.hashCode.abs() % 360;
    final seed = HSVColor.fromAHSV(1, hue.toDouble(), .42, .72).toColor();
    final initial = track.title.trim().isEmpty
        ? null
        : track.title.trim().characters.first.toUpperCase();
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [seed, Color.lerp(seed, colors.surface, .45)!],
        ),
      ),
      child: Center(
        child: initial == null
            ? Icon(Icons.music_note, color: colors.onPrimary)
            : Text(
                initial,
                style: TextStyle(
                  color: colors.onPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
      ),
    );
  }
}
