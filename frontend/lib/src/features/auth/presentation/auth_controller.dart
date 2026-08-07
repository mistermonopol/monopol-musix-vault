import 'package:flutter/foundation.dart';

import '../../../core/api/api_client.dart';
import '../data/session_store.dart';
import '../domain/auth_session.dart';

enum AuthStatus { restoring, signedOut, authenticating, signedIn }

final class AuthController extends ChangeNotifier {
  AuthController({required this.api, required this.store});

  final ApiClient api;
  final SessionStore store;
  AuthStatus status = AuthStatus.restoring;
  AuthSession? session;
  String? errorMessage;

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

  Future<void> signOut() async {
    session = null;
    errorMessage = null;
    await store.clear();
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
