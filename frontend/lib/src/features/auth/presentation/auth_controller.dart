import 'package:flutter/foundation.dart';

import '../../../core/api/api_client.dart';
import '../data/session_store.dart';
import '../domain/auth_session.dart';
import '../../library/domain/catalog_track.dart';
import '../../player/domain/playback_source.dart';

enum AuthStatus { restoring, signedOut, authenticating, signedIn }

final class AuthController extends ChangeNotifier {
  AuthController({required this.api, required this.store});

  final ApiClient api;
  final SessionStore store;
  AuthStatus status = AuthStatus.restoring;
  AuthSession? session;
  String? errorMessage;
  String? _accessCode;

  Future<void> restore() async {
    final credentials = await store.read();
    if (credentials == null) {
      status = AuthStatus.signedOut;
      notifyListeners();
      return;
    }
    try {
      session = await api.refresh(
        refreshToken: credentials.refreshToken,
        accessCode: credentials.accessCode,
      );
      _accessCode = credentials.accessCode;
      await store.write(
        StoredCredentials(
          accessCode: credentials.accessCode,
          refreshToken: session!.refreshToken,
        ),
      );
      status = AuthStatus.signedIn;
    } catch (_) {
      await store.clear();
      status = AuthStatus.signedOut;
    }
    notifyListeners();
  }

  Future<void> authenticate({
    required String email,
    required String password,
    required String accessCode,
    required bool bootstrap,
  }) async {
    status = AuthStatus.authenticating;
    errorMessage = null;
    notifyListeners();
    try {
      session = await api.authenticate(
        email: email.trim(),
        password: password,
        accessCode: accessCode,
        bootstrap: bootstrap,
      );
      _accessCode = accessCode;
      await store.write(
        StoredCredentials(
          accessCode: accessCode,
          refreshToken: session!.refreshToken,
        ),
      );
      status = AuthStatus.signedIn;
    } on ApiException catch (error) {
      errorMessage = error.message;
      status = AuthStatus.signedOut;
    } catch (_) {
      errorMessage = 'Server nicht erreichbar.';
      status = AuthStatus.signedOut;
    }
    notifyListeners();
  }

  Future<CatalogPage> listTracks({String search = ''}) {
    final currentSession = session;
    final currentAccessCode = _accessCode;
    if (currentSession == null || currentAccessCode == null) {
      throw const ApiException('Session abgelaufen.', statusCode: 401);
    }
    return api.listTracks(
      accessCode: currentAccessCode,
      accessToken: currentSession.accessToken,
      search: search,
    );
  }

  List<PlaybackSource> playbackSources(List<CatalogTrack> tracks) {
    final currentSession = session;
    if (currentSession == null) {
      throw const ApiException('Session abgelaufen.', statusCode: 401);
    }
    return tracks
        .map(
          (track) => PlaybackSource(
            track: track,
            uri: api.streamUri(track.id),
            headers: {'Authorization': 'Bearer ${currentSession.accessToken}'},
          ),
        )
        .toList(growable: false);
  }

  Future<void> signOut() async {
    session = null;
    _accessCode = null;
    errorMessage = null;
    await store.clear();
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
