import 'package:flutter/material.dart';

import '../core/api/api_client.dart';
import '../core/config/app_config.dart';
import '../features/auth/data/session_store.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/library/presentation/library_screen.dart';

final class MusixVaultApp extends StatefulWidget {
  const MusixVaultApp({required this.authController, super.key});

  factory MusixVaultApp.bootstrap() {
    final config = AppConfig.fromEnvironment();
    return MusixVaultApp(
      authController: AuthController(
        api: ApiClient(baseUrl: config.apiBaseUrl),
        store: SecureSessionStore(),
      ),
    );
  }

  final AuthController authController;

  @override
  State<MusixVaultApp> createState() => _MusixVaultAppState();
}

final class _MusixVaultAppState extends State<MusixVaultApp> {
  @override
  void initState() {
    super.initState();
    widget.authController.addListener(_refresh);
    widget.authController.restore();
  }

  @override
  void dispose() {
    widget.authController.removeListener(_refresh);
    widget.authController.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Monopol Musix Vault',
    debugShowCheckedModeBanner: false,
    themeMode: ThemeMode.dark,
    darkTheme: ThemeData(
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF8B5CF6),
        brightness: Brightness.dark,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
      cardTheme: const CardThemeData(elevation: 0),
      useMaterial3: true,
    ),
    home: _home(),
  );

  Widget _home() => switch (widget.authController.status) {
    AuthStatus.restoring => const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    ),
    AuthStatus.signedOut ||
    AuthStatus.authenticating => LoginScreen(controller: widget.authController),
    AuthStatus.signedIn => LibraryScreen(authController: widget.authController),
  };
}
