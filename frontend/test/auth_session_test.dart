import 'package:flutter_test/flutter_test.dart';
import 'package:monopol_musix_vault/src/features/auth/domain/auth_session.dart';

void main() {
  test('parses an authentication session', () {
    final session = AuthSession.fromJson({
      'accessToken': 'access',
      'refreshToken': 'refresh',
      'user': {'id': '42', 'email': 'owner@example.test', 'role': 'admin'},
    });

    expect(session.accessToken, 'access');
    expect(session.user.email, 'owner@example.test');
    expect(session.user.role, 'admin');
  });
}
