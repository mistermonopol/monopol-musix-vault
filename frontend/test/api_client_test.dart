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
