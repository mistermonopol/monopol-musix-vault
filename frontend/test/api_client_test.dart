import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:monopol_musix_vault/src/core/api/api_client.dart';
import 'package:monopol_musix_vault/src/features/user_data/domain/user_data_models.dart';

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
                'hasArtwork': true,
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
    expect(page.items.single.hasArtwork, isTrue);
  });

  test('lists and updates synchronized favorites', () async {
    var requestIndex = 0;
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        expect(request.headers['X-Access-Code'], 'private-access-code');
        expect(request.headers['Authorization'], 'Bearer access-token');
        requestIndex += 1;
        if (requestIndex == 1) {
          expect(request.method, 'GET');
          return http.Response(
            jsonEncode({
              'items': [
                {
                  'favoritedAt': '2026-08-08T12:00:00.000Z',
                  'track': {'id': 'track-id', 'title': 'Track'},
                },
              ],
            }),
            200,
          );
        }
        expect(request.url.path, '/favorites/tracks/track-id');
        if (requestIndex == 2) {
          expect(request.method, 'PUT');
          return http.Response(jsonEncode({'favorite': {}}), 200);
        }
        expect(request.method, 'DELETE');
        return http.Response('', 204);
      }),
    );

    final favorites = await client.listFavoriteTrackIds(
      accessCode: 'private-access-code',
      accessToken: 'access-token',
    );
    await client.setTrackFavorite(
      trackId: 'track-id',
      favorite: true,
      accessCode: 'private-access-code',
      accessToken: 'access-token',
    );
    await client.setTrackFavorite(
      trackId: 'track-id',
      favorite: false,
      accessCode: 'private-access-code',
      accessToken: 'access-token',
    );

    expect(favorites, {'track-id'});
  });

  test('preserves a production proxy prefix for API and stream URLs', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://vault.example.test/api/'),
      httpClient: MockClient((request) async {
        expect(
          request.url.toString(),
          'https://vault.example.test/api/auth/login',
        );
        return http.Response(
          jsonEncode({
            'accessToken': 'access',
            'refreshToken': 'refresh',
            'user': {'id': 'user', 'email': 'owner@example.test'},
          }),
          200,
        );
      }),
    );

    await client.authenticate(
      email: 'owner@example.test',
      password: 'a-secure-password',
      accessCode: 'private-access-code',
    );

    expect(
      client.streamUri('track-id').toString(),
      'https://vault.example.test/api/tracks/track-id/stream',
    );
  });

  test('builds a secret-free stream URL', () {
    final client = ApiClient(baseUrl: Uri.parse('https://api.example.test'));

    final uri = client.streamUri('track-id');

    expect(uri.toString(), 'https://api.example.test/tracks/track-id/stream');
    expect(uri.hasQuery, isFalse);
  });

  test('fetches artwork bytes with both authentication layers', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        expect(request.url.path, '/tracks/track-id/artwork');
        expect(request.url.query, isEmpty);
        expect(request.headers['X-Access-Code'], 'code');
        expect(request.headers['Authorization'], 'Bearer token');
        return http.Response.bytes(
          [0xff, 0xd8, 0xff, 0xd9],
          200,
          headers: {'content-type': 'image/jpeg'},
        );
      }),
    );

    final bytes = await client.getTrackArtwork(
      trackId: 'track-id',
      accessCode: 'code',
      accessToken: 'token',
    );

    expect(bytes, [0xff, 0xd8, 0xff, 0xd9]);
  });

  test('returns null when artwork is unavailable', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((_) async => http.Response('', 404)),
    );

    expect(
      await client.getTrackArtwork(
        trackId: 'track-id',
        accessCode: 'code',
        accessToken: 'token',
      ),
      isNull,
    );
  });

  test('reports listening progress with both authentication layers', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        expect(request.url.path, '/listening/events');
        expect(request.headers['X-Access-Code'], 'code');
        expect(request.headers['Authorization'], 'Bearer token');
        expect(jsonDecode(request.body), {
          'trackId': 'track-id',
          'eventType': 'progress',
          'positionSeconds': 12.5,
        });
        return http.Response(
          jsonEncode({
            'event': {'id': 'event-id'},
          }),
          201,
        );
      }),
    );

    await client.reportListeningEvent(
      trackId: 'track-id',
      eventType: ListeningEventType.progress,
      positionSeconds: 12.5,
      accessCode: 'code',
      accessToken: 'token',
    );
  });

  test('parses playlists and normalized brain graph', () async {
    var requestIndex = 0;
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        requestIndex++;
        if (requestIndex == 1) {
          return http.Response(
            jsonEncode({
              'items': [
                {
                  'id': 'playlist-id',
                  'name': 'Mix',
                  'description': '',
                  'items': [
                    {'id': 'item-id', 'trackId': 'track-id', 'position': 0},
                  ],
                  'createdAt': '2026-01-01T00:00:00Z',
                  'updatedAt': '2026-01-01T00:00:00Z',
                },
              ],
            }),
            200,
          );
        }
        return http.Response(
          jsonEncode({
            'nodes': [
              {
                'id': 'track:1',
                'label': 'Track',
                'type': 'track',
                'properties': {
                  'year': 2026,
                  'releaseDate': '2026',
                  'favorite': true,
                },
              },
            ],
            'edges': [
              {
                'id': 'edge:1',
                'source': 'artist:1',
                'target': 'track:1',
                'type': 'artist',
              },
            ],
          }),
          200,
        );
      }),
    );

    final playlists = await client.listPlaylists(
      accessCode: 'code',
      accessToken: 'token',
    );
    final graph = await client.getBrainGraph(
      accessCode: 'code',
      accessToken: 'token',
    );

    expect(playlists.single.items.single.trackId, 'track-id');
    expect(graph.nodes.single.label, 'Track');
    expect(graph.nodes.single.properties['year'], 2026);
    expect(graph.nodes.single.properties['releaseDate'], '2026');
    expect(graph.edges.single.target, 'track:1');
  });

  test('syncs brain through proxy with exact authenticated request', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://vault.example.test/api/'),
      httpClient: MockClient((request) async {
        expect(request.method, 'POST');
        expect(
          request.url,
          Uri.parse('https://vault.example.test/api/brain/sync'),
        );
        expect(request.headers['X-Access-Code'], 'code');
        expect(request.headers['Authorization'], 'Bearer token');
        expect(request.headers['Content-Type'], 'application/json');
        expect(request.bodyBytes, isEmpty);
        return http.Response(
          jsonEncode({
            'counts': {'albums': 2, 'artists': 3, 'genres': 4, 'tracks': 5},
            'errors': [
              {
                'message': 'Could not write note',
                'noteId': 'track-id',
                'noteType': 'track',
              },
            ],
          }),
          200,
        );
      }),
    );

    final result = await client.syncBrain(
      accessCode: 'code',
      accessToken: 'token',
    );

    expect(result.counts.albums, 2);
    expect(result.counts.artists, 3);
    expect(result.counts.genres, 4);
    expect(result.counts.tracks, 5);
    expect(result.errors.single.message, 'Could not write note');
    expect(result.errors.single.noteId, 'track-id');
    expect(result.errors.single.noteType, 'track');
  });

  test('gets and starts admin artwork lookup with exact contract', () async {
    var requestIndex = 0;
    final client = ApiClient(
      baseUrl: Uri.parse('https://vault.example.test/api/'),
      httpClient: MockClient((request) async {
        requestIndex++;
        expect(request.url.path, '/api/admin/artwork/lookup');
        expect(request.headers['X-Access-Code'], 'code');
        expect(request.headers['Authorization'], 'Bearer token');
        if (requestIndex == 1) {
          expect(request.method, 'GET');
          return http.Response(
            jsonEncode({
              'state': 'idle',
              'queued': 0,
              'attempted': 0,
              'matched': 0,
              'coversApplied': 0,
              'tracksUpdated': 0,
              'noMatch': 0,
              'noCover': 0,
              'failed': 0,
              'errors': <String>[],
              'startedAt': null,
              'finishedAt': null,
            }),
            200,
          );
        }
        expect(request.method, 'POST');
        expect(jsonDecode(request.body), {'retry': true});
        return http.Response(
          jsonEncode({
            'state': 'running',
            'queued': 12,
            'attempted': 3,
            'matched': 2,
            'coversApplied': 1,
            'tracksUpdated': 4,
            'noMatch': 1,
            'noCover': 0,
            'failed': 0,
            'errors': <String>[],
            'startedAt': '2026-08-08T12:00:00.000Z',
            'finishedAt': null,
          }),
          202,
        );
      }),
    );

    final initial = await client.getArtworkLookupStatus(
      accessCode: 'code',
      accessToken: 'token',
    );
    final running = await client.startArtworkLookup(
      retry: true,
      accessCode: 'code',
      accessToken: 'token',
    );

    expect(initial.state.name, 'idle');
    expect(running.isRunning, isTrue);
    expect(running.queued, 12);
    expect(running.attempted, 3);
    expect(running.coversApplied, 1);
    expect(running.startedAt, DateTime.utc(2026, 8, 8, 12));
  });

  test('artwork lookup exposes disabled API errors', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://vault.example.test/api'),
      httpClient: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'error': 'Artwork lookup is disabled',
            'code': 'ARTWORK_LOOKUP_DISABLED',
          }),
          503,
        ),
      ),
    );

    await expectLater(
      client.startArtworkLookup(
        retry: false,
        accessCode: 'code',
        accessToken: 'token',
      ),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 503)
            .having((error) => error.code, 'code', 'ARTWORK_LOOKUP_DISABLED'),
      ),
    );
  });

  test('brain sync exposes API status, code, and message', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://vault.example.test/api'),
      httpClient: MockClient((request) async {
        expect(request.url.path, '/api/brain/sync');
        return http.Response(
          jsonEncode({'error': 'Admin role required', 'code': 'FORBIDDEN'}),
          403,
        );
      }),
    );

    await expectLater(
      client.syncBrain(accessCode: 'code', accessToken: 'token'),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 403)
            .having((error) => error.code, 'code', 'FORBIDDEN')
            .having((error) => error.message, 'message', 'Admin role required'),
      ),
    );
  });

  test('queue transfer remains opt-in and never requests autoplay', () async {
    final client = ApiClient(
      baseUrl: Uri.parse('https://api.example.test'),
      httpClient: MockClient((request) async {
        expect(request.url.path, '/queue/transfer');
        expect(jsonDecode(request.body), {
          'sourceDeviceId': 'source',
          'targetDeviceId': 'target',
        });
        return http.Response(
          jsonEncode({
            'autoPlay': false,
            'queue': {
              'deviceId': 'target',
              'items': ['track-id'],
              'currentIndex': 0,
              'positionSeconds': 4,
              'updatedAt': '2026-01-01T00:00:00Z',
            },
          }),
          200,
        );
      }),
    );

    final result = await client.transferQueue(
      sourceDeviceId: 'source',
      targetDeviceId: 'target',
      accessCode: 'code',
      accessToken: 'token',
    );

    expect(result.autoPlay, isFalse);
    expect(result.queue.deviceId, 'target');
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
