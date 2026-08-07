import 'package:flutter/material.dart';

import '../core/api/api_client.dart';
import '../core/config/app_config.dart';
import '../features/auth/data/session_store.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';

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
    AuthStatus.signedIn => _LibraryPlaceholder(
      controller: widget.authController,
    ),
  };
}

final class _LibraryPlaceholder extends StatelessWidget {
  const _LibraryPlaceholder({required this.controller});

  final AuthController controller;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Musix Vault'),
      actions: [
        IconButton(
          tooltip: 'Abmelden',
          onPressed: controller.signOut,
          icon: const Icon(Icons.logout),
        ),
      ],
    ),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.library_music_rounded, size: 72),
            const SizedBox(height: 18),
            Text(
              'Willkommen, ${controller.session!.user.email}',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Die sichere Verbindung steht. Als Nächstes folgen Bibliothek und Player.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
}
