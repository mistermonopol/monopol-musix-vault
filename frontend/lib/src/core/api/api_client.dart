import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/auth/domain/auth_session.dart';
import '../../features/library/domain/catalog_track.dart';

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

  Uri streamUri(String trackId) => _resolve('/tracks/$trackId/stream');

  Uri _resolve(String path) => baseUrl.resolve(path);

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
