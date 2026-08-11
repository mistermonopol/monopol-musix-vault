import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../player/domain/playback_source.dart';
import '../domain/local_music_track.dart';

enum LocalMusicAccess { unknown, granted, denied, unsupported }

final class LocalMusicController extends ChangeNotifier {
  LocalMusicController({MethodChannel? channel})
    : _channel =
          channel ?? const MethodChannel('de.monopol.musix_vault/local_music');

  final MethodChannel _channel;
  List<LocalMusicTrack> tracks = const [];
  LocalMusicAccess access = LocalMusicAccess.unknown;
  bool loading = false;
  String? errorMessage;
  String? preparingTrackId;

  Future<void> load() async {
    if (loading) return;
    loading = true;
    errorMessage = null;
    notifyListeners();
    try {
      final values = await _channel.invokeListMethod<Object?>('listAudio');
      tracks = (values ?? const [])
          .whereType<Map<Object?, Object?>>()
          .map(LocalMusicTrack.fromPlatform)
          .where(
            (item) =>
                !item.track.title.trimLeft().toUpperCase().startsWith('AUD'),
          )
          .toList(growable: false);
      access = LocalMusicAccess.granted;
    } on PlatformException catch (error) {
      access = switch (error.code) {
        'PERMISSION_DENIED' => LocalMusicAccess.denied,
        'UNSUPPORTED' => LocalMusicAccess.unsupported,
        _ => LocalMusicAccess.unknown,
      };
      errorMessage =
          error.message ?? 'Lokale Musik konnte nicht geladen werden.';
    } on MissingPluginException {
      access = LocalMusicAccess.unsupported;
      errorMessage =
          'Lokale Musik wird derzeit nur von der Android-App unterstützt.';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<PlaybackSource> preparePlayback(LocalMusicTrack item) async {
    if (preparingTrackId != null) {
      throw StateError('Ein lokaler Titel wird bereits vorbereitet.');
    }
    preparingTrackId = item.track.id;
    notifyListeners();
    try {
      final path = await _channel.invokeMethod<String>('prepareAudio', {
        'contentUri': item.contentUri.toString(),
        'mediaId': item.track.id.substring('local:'.length),
      });
      if (path == null || path.isEmpty) {
        throw PlatformException(
          code: 'PREPARE_FAILED',
          message: 'Lokaler Titel konnte nicht vorbereitet werden.',
        );
      }
      return PlaybackSource(
        track: item.track,
        uri: File(path).uri,
        headers: const {},
      );
    } finally {
      preparingTrackId = null;
      notifyListeners();
    }
  }
}
