import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:monopol_musix_vault/src/core/api/api_client.dart';

void main() {
  test('login sends access code and parses the session', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        expect(request.url.toString(), 'https://api.example.test/auth/login');
        expect(request.headers['X-Access-Code'], 'private-access-code');
        expect(jsonDecode(request.body), {
          'email': 'owner@example.test',
          'password': 'a-secure-password',
        });
        return http.Response(
          jsonEncode({
            'accessToken': 'access-token',
            'refreshToken': 'refresh-token',
            'user': {
              'id': 'user-id',
              'email': 'owner@example.test',
              'role': 'admin',
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final session = await client.authenticate(
      email: 'owner@example.test',
      password: 'a-secure-password',
      accessCode: 'private-access-code',
    );

    expect(session.accessToken, 'access-token');
    expect(session.refreshToken, 'refresh-token');
    expect(session.user.role, 'admin');
  });

  test('lists tracks with both authentication layers', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        expect(request.url.path, '/library/tracks');
        expect(request.url.queryParameters['search'], 'Artist');
        expect(request.headers['X-Access-Code'], 'private-access-code');
        expect(request.headers['Authorization'], 'Bearer access-token');
        return http.Response(
          jsonEncode({
            'items': [
              {
                'id': 'track-id',
                'title': 'Track title',
                'artists': [
                  {'id': 'artist-id', 'name': 'Artist'},
                ],
                'album': {'id': 'album-id', 'title': 'Album'},
                'durationSeconds': 185.4,
                'year': 2026,
              },
            ],
            'page': 1,
            'pageSize': 100,
            'total': 1,
          }),
          200,
        );
      }),
    );

    final page = await client.listTracks(
      accessCode: 'private-access-code',
      accessToken: 'access-token',
      search: 'Artist',
    );

    expect(page.total, 1);
    expect(page.items.single.title, 'Track title');
    expect(page.items.single.artistLabel, 'Artist');
    expect(page.items.single.album, 'Album');
  });

  test('API errors expose status and server code', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient(
        (_) async => http.Response(
          jsonEncode({'error': 'Access denied', 'code': 'ACCESS_DENIED'}),
          403,
        ),
      ),
    );

    await expectLater(
      client.authenticate(
        email: 'owner@example.test',
        password: 'a-secure-password',
        accessCode: 'wrong-access-code',
      ),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 403)
            .having((error) => error.code, 'code', 'ACCESS_DENIED'),
      ),
    );
  });
}
