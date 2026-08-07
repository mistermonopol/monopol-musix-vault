final class AuthUser {
  const AuthUser({required this.id, required this.email, this.role});

  factory AuthUser.fromJson(Map<String, Object?> json) => AuthUser(
    id: json['id'] as String,
    email: json['email'] as String,
    role: json['role'] as String?,
  );

  final String id;
  final String email;
  final String? role;
}

final class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthSession.fromJson(Map<String, Object?> json) => AuthSession(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    user: AuthUser.fromJson(json['user'] as Map<String, Object?>),
  );

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
}
