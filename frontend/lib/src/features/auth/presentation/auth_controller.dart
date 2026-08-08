import 'dart:collection';

import 'package:flutter/foundation.dart';

import '../../../core/api/api_client.dart';
import '../data/session_store.dart';
import '../domain/auth_session.dart';
import '../../library/domain/catalog_track.dart';
import '../../player/domain/playback_source.dart';
import '../../settings/domain/artwork_lookup_progress.dart';
import '../../user_data/domain/user_data_models.dart';

enum AuthStatus { restoring, signedOut, authenticating, signedIn }

final class AuthController extends ChangeNotifier {
  AuthController({required this.api, required this.store});

  final ApiClient api;
  final SessionStore store;
  AuthStatus status = AuthStatus.restoring;
  AuthSession? session;
  String? errorMessage;
  String? _accessCode;
  final LinkedHashMap<String, Uint8List?> _artworkCache = LinkedHashMap();
  final Map<String, Future<Uint8List?>> _artworkRequests = {};
  int _artworkCacheBytes = 0;

  static const int _maxArtworkEntries = 64;
  static const int _maxArtworkBytes = 24 * 1024 * 1024;

  String get serverLabel => api.baseUrl.toString();

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

  Future<Set<String>> listFavoriteTrackIds() {
    final credentials = _activeCredentials();
    return api.listFavoriteTrackIds(
      accessCode: credentials.accessCode,
      accessToken: credentials.accessToken,
    );
  }

  Future<void> setTrackFavorite(String trackId, {required bool favorite}) {
    final credentials = _activeCredentials();
    return api.setTrackFavorite(
      trackId: trackId,
      favorite: favorite,
      accessCode: credentials.accessCode,
      accessToken: credentials.accessToken,
    );
  }

  Future<List<RecentListeningItem>> listRecent() {
    final c = _activeCredentials();
    return api.listRecent(accessCode: c.accessCode, accessToken: c.accessToken);
  }

  Future<void> reportListeningEvent(
    String trackId,
    ListeningEventType type, {
    double? positionSeconds,
  }) {
    final c = _activeCredentials();
    return api.reportListeningEvent(
      trackId: trackId,
      eventType: type,
      positionSeconds: positionSeconds,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<ListeningPosition> saveListeningPosition(
    String trackId,
    double seconds,
  ) {
    final c = _activeCredentials();
    return api.saveListeningPosition(
      trackId: trackId,
      positionSeconds: seconds,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<List<VaultPlaylist>> listPlaylists() {
    final c = _activeCredentials();
    return api.listPlaylists(
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<VaultPlaylist> createPlaylist(String name, String description) {
    final c = _activeCredentials();
    return api.createPlaylist(
      name: name,
      description: description,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<VaultPlaylist> updatePlaylist(
    String id,
    String name,
    String description,
  ) {
    final c = _activeCredentials();
    return api.updatePlaylist(
      id: id,
      name: name,
      description: description,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<VaultPlaylist> replacePlaylistItems(String id, List<String> trackIds) {
    final c = _activeCredentials();
    return api.replacePlaylistItems(
      id: id,
      trackIds: trackIds,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<void> deletePlaylist(String id) {
    final c = _activeCredentials();
    return api.deletePlaylist(
      id: id,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<List<VaultDevice>> listDevices() {
    final c = _activeCredentials();
    return api.listDevices(
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<VaultDevice> registerDevice(String name, String kind) {
    final c = _activeCredentials();
    return api.registerDevice(
      name: name,
      kind: kind,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<void> deleteDevice(String id) {
    final c = _activeCredentials();
    return api.deleteDevice(
      id: id,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<QueueSnapshot> getQueue(String deviceId) {
    final c = _activeCredentials();
    return api.getQueue(
      deviceId: deviceId,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<QueueSnapshot> saveQueue(
    String deviceId,
    List<String> items,
    int? currentIndex,
    double positionSeconds,
  ) {
    final c = _activeCredentials();
    return api.saveQueue(
      deviceId: deviceId,
      items: items,
      currentIndex: currentIndex,
      positionSeconds: positionSeconds,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<QueueTransferResult> transferQueue(
    String sourceDeviceId,
    String targetDeviceId,
  ) {
    final c = _activeCredentials();
    return api.transferQueue(
      sourceDeviceId: sourceDeviceId,
      targetDeviceId: targetDeviceId,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<Uint8List?> trackArtwork(CatalogTrack track) {
    if (!track.hasArtwork) return Future.value();
    if (_artworkCache.containsKey(track.id)) {
      final bytes = _artworkCache.remove(track.id);
      _artworkCache[track.id] = bytes;
      return Future.value(bytes);
    }
    return _artworkRequests[track.id] ??= _fetchArtwork(track.id);
  }

  Future<Uint8List?> _fetchArtwork(String trackId) async {
    try {
      final c = _activeCredentials();
      final bytes = await api.getTrackArtwork(
        trackId: trackId,
        accessCode: c.accessCode,
        accessToken: c.accessToken,
      );
      _cacheArtwork(trackId, bytes);
      return bytes;
    } finally {
      _artworkRequests.remove(trackId);
    }
  }

  void _cacheArtwork(String trackId, Uint8List? bytes) {
    final previous = _artworkCache.remove(trackId);
    _artworkCacheBytes -= previous?.lengthInBytes ?? 0;
    _artworkCache[trackId] = bytes;
    _artworkCacheBytes += bytes?.lengthInBytes ?? 0;
    while (_artworkCache.length > _maxArtworkEntries ||
        _artworkCacheBytes > _maxArtworkBytes) {
      final oldest = _artworkCache.keys.first;
      final removed = _artworkCache.remove(oldest);
      _artworkCacheBytes -= removed?.lengthInBytes ?? 0;
    }
  }

  Future<ArtworkLookupProgress> getArtworkLookupStatus() {
    final c = _activeCredentials();
    return api.getArtworkLookupStatus(
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<ArtworkLookupProgress> startArtworkLookup({required bool retry}) {
    final c = _activeCredentials();
    return api.startArtworkLookup(
      retry: retry,
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  void invalidateArtworkCache() {
    _artworkCache.clear();
    _artworkCacheBytes = 0;
  }

  Future<BrainGraph> getBrainGraph() {
    final c = _activeCredentials();
    return api.getBrainGraph(
      accessCode: c.accessCode,
      accessToken: c.accessToken,
    );
  }

  Future<BrainSyncResult> syncBrain() {
    final c = _activeCredentials();
    return api.syncBrain(accessCode: c.accessCode, accessToken: c.accessToken);
  }

  ({String accessCode, String accessToken}) _activeCredentials() {
    final currentSession = session;
    final currentAccessCode = _accessCode;
    if (currentSession == null || currentAccessCode == null) {
      throw const ApiException('Session abgelaufen.', statusCode: 401);
    }
    return (
      accessCode: currentAccessCode,
      accessToken: currentSession.accessToken,
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
    _artworkCache.clear();
    _artworkRequests.clear();
    _artworkCacheBytes = 0;
    errorMessage = null;
    await store.clear();
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
