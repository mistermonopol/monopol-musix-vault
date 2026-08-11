import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';

import 'src/app/musix_vault_app.dart';
import 'src/features/player/application/media_session_handler.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  final mediaSession = await AudioService.init(
    builder: VaultMediaSessionHandler.new,
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'de.monopol.musix_vault.playback',
      androidNotificationChannelName: 'Musikwiedergabe',
      androidNotificationOngoing: false,
      androidStopForegroundOnPause: false,
    ),
  );
  runApp(await MusixVaultApp.bootstrap(mediaSession: mediaSession));
}
