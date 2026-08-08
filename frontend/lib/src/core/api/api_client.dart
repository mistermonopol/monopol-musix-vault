import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/auth/domain/auth_session.dart';
import '../../features/library/domain/catalog_track.dart';
import '../../features/user_data/domain/user_data_models.dart';

final class ApiException implements Exception {
  const ApiException(this.message, {required this.statusCode, this.code});

  final String message;
  final int statusCode;
  final String? code;

  @override
  String toString() => message;
}

final class ApiClient {
  ApiClient({required this.baseUrl, http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

  final Uri baseUrl;
  final http.Client _httpClient;

  Future<AuthSession> authenticate({
    required String email,
    required String password,
    required String accessCode,
    bool bootstrap = false,
  }) async {
    final response = await _httpClient.post(
      _resolve('/auth/${bootstrap ? 'bootstrap' : 'login'}'),
      headers: _headers(accessCode),
      body: jsonEncode({'email': email, 'password': password}),
    );
    return AuthSession.fromJson(_decode(response));
  }

  Future<AuthSession> refresh({
    required String refreshToken,
    required String accessCode,
  }) async {
    final response = await _httpClient.post(
      _resolve('/auth/refresh'),
      headers: _headers(accessCode),
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    return AuthSession.fromJson(_decode(response));
  }

  Future<CatalogPage> listTracks({
    required String accessCode,
    required String accessToken,
    String search = '',
    int limit = 100,
    int offset = 0,
  }) async {
    final uri = _resolve('/library/tracks').replace(
      queryParameters: {
        'search': search.trim(),
        'limit': '$limit',
        'offset': '$offset',
      },
    );
    final response = await _httpClient.get(
      uri,
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return CatalogPage.fromJson(_decode(response));
  }

  Future<Set<String>> listFavoriteTrackIds({
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.get(
      _resolve('/favorites/tracks'),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    final payload = _decode(response);
    final items = payload['items'];
    if (items is! List) return {};
    return items
        .whereType<Map<String, Object?>>()
        .map((favorite) => favorite['track'])
        .whereType<Map<String, Object?>>()
        .map((track) => track['id'])
        .whereType<String>()
        .toSet();
  }

  Future<void> setTrackFavorite({
    required String trackId,
    required bool favorite,
    required String accessCode,
    required String accessToken,
  }) async {
    final uri = _resolve('/favorites/tracks/$trackId');
    final headers = _headers(accessCode, accessToken: accessToken);
    final response = favorite
        ? await _httpClient.put(uri, headers: headers)
        : await _httpClient.delete(uri, headers: headers);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _decode(response);
    }
  }

  Future<List<RecentListeningItem>> listRecent({
    required String accessCode,
    required String accessToken,
    int limit = 25,
  }) async {
    final response = await _httpClient.get(
      _resolve(
        '/listening/recent',
      ).replace(queryParameters: {'limit': '$limit'}),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return _items(_decode(response)).map(RecentListeningItem.fromJson).toList();
  }

  Future<void> reportListeningEvent({
    required String trackId,
    required ListeningEventType eventType,
    required String accessCode,
    required String accessToken,
    double? positionSeconds,
  }) async {
    final response = await _httpClient.post(
      _resolve('/listening/events'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({
        'trackId': trackId,
        'eventType': eventType.name,
        'positionSeconds': ?positionSeconds,
      }),
    );
    _decode(response);
  }

  Future<ListeningPosition> getListeningPosition({
    required String trackId,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.get(
      _resolve('/listening/positions/$trackId'),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return ListeningPosition.fromJson(
      _decode(response)['position'] as Map<String, Object?>,
    );
  }

  Future<ListeningPosition> saveListeningPosition({
    required String trackId,
    required double positionSeconds,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.put(
      _resolve('/listening/positions/$trackId'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({'positionSeconds': positionSeconds}),
    );
    return ListeningPosition.fromJson(
      _decode(response)['position'] as Map<String, Object?>,
    );
  }

  Future<List<VaultPlaylist>> listPlaylists({
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.get(
      _resolve('/playlists'),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return _items(_decode(response)).map(VaultPlaylist.fromJson).toList();
  }

  Future<VaultPlaylist> createPlaylist({
    required String name,
    required String description,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.post(
      _resolve('/playlists'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({'name': name, 'description': description}),
    );
    return VaultPlaylist.fromJson(
      _decode(response)['playlist'] as Map<String, Object?>,
    );
  }

  Future<VaultPlaylist> updatePlaylist({
    required String id,
    required String name,
    required String description,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.patch(
      _resolve('/playlists/$id'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({'name': name, 'description': description}),
    );
    return VaultPlaylist.fromJson(
      _decode(response)['playlist'] as Map<String, Object?>,
    );
  }

  Future<VaultPlaylist> replacePlaylistItems({
    required String id,
    required List<String> trackIds,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.put(
      _resolve('/playlists/$id/items'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({'trackIds': trackIds}),
    );
    return VaultPlaylist.fromJson(
      _decode(response)['playlist'] as Map<String, Object?>,
    );
  }

  Future<void> deletePlaylist({
    required String id,
    required String accessCode,
    required String accessToken,
  }) => _delete('/playlists/$id', accessCode, accessToken);

  Future<List<VaultDevice>> listDevices({
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.get(
      _resolve('/devices'),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return _items(_decode(response)).map(VaultDevice.fromJson).toList();
  }

  Future<VaultDevice> registerDevice({
    required String name,
    required String kind,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.post(
      _resolve('/devices'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({'name': name, 'kind': kind}),
    );
    return VaultDevice.fromJson(
      _decode(response)['device'] as Map<String, Object?>,
    );
  }

  Future<void> deleteDevice({
    required String id,
    required String accessCode,
    required String accessToken,
  }) => _delete('/devices/$id', accessCode, accessToken);

  Future<QueueSnapshot> getQueue({
    required String deviceId,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.get(
      _resolve('/queue/$deviceId'),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return QueueSnapshot.fromJson(
      _decode(response)['queue'] as Map<String, Object?>,
    );
  }

  Future<QueueSnapshot> saveQueue({
    required String deviceId,
    required List<String> items,
    required int? currentIndex,
    required double positionSeconds,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.put(
      _resolve('/queue/$deviceId'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({
        'items': items,
        'currentIndex': currentIndex,
        'positionSeconds': positionSeconds,
      }),
    );
    return QueueSnapshot.fromJson(
      _decode(response)['queue'] as Map<String, Object?>,
    );
  }

  Future<QueueTransferResult> transferQueue({
    required String sourceDeviceId,
    required String targetDeviceId,
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.post(
      _resolve('/queue/transfer'),
      headers: _headers(accessCode, accessToken: accessToken),
      body: jsonEncode({
        'sourceDeviceId': sourceDeviceId,
        'targetDeviceId': targetDeviceId,
      }),
    );
    return QueueTransferResult.fromJson(_decode(response));
  }

  Future<BrainGraph> getBrainGraph({
    required String accessCode,
    required String accessToken,
  }) async {
    final response = await _httpClient.get(
      _resolve('/brain/graph'),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    return BrainGraph.fromJson(_decode(response));
  }

  Uri streamUri(String trackId) => _resolve('/tracks/$trackId/stream');

  Iterable<Map<String, Object?>> _items(Map<String, Object?> payload) =>
      (payload['items'] as List? ?? const []).whereType<Map<String, Object?>>();

  Future<void> _delete(
    String path,
    String accessCode,
    String accessToken,
  ) async {
    final response = await _httpClient.delete(
      _resolve(path),
      headers: _headers(accessCode, accessToken: accessToken),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _decode(response);
    }
  }

  Uri _resolve(String path) {
    final normalizedBase = baseUrl.path.endsWith('/')
        ? baseUrl
        : baseUrl.replace(path: '${baseUrl.path}/');
    final relativePath = path.startsWith('/') ? path.substring(1) : path;
    return normalizedBase.resolve(relativePath);
  }

  Map<String, String> _headers(String accessCode, {String? accessToken}) => {
    'Content-Type': 'application/json',
    'X-Access-Code': accessCode,
    if (accessToken != null) 'Authorization': 'Bearer $accessToken',
  };

  Map<String, Object?> _decode(http.Response response) {
    Object? payload;
    try {
      payload = jsonDecode(response.body);
    } on FormatException {
      payload = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = payload is Map<String, Object?> ? payload : null;
      throw ApiException(
        error?['error'] as String? ?? 'Request failed (${response.statusCode})',
        statusCode: response.statusCode,
        code: error?['code'] as String?,
      );
    }
    if (payload is! Map<String, Object?>) {
      throw const ApiException('Invalid API response', statusCode: 502);
    }
    return payload;
  }
}
