import 'package:flutter/material.dart';

import '../../../core/api/api_client.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../user_data/domain/user_data_models.dart';

final class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    required this.authController,
    required this.onOpenBrain,
    super.key,
  });

  final AuthController authController;
  final VoidCallback onOpenBrain;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

final class _SettingsScreenState extends State<SettingsScreen> {
  bool _compactGraph = false;
  bool _confirmQueueChanges = true;
  bool _syncing = false;
  BrainSyncResult? _syncResult;
  Object? _syncError;

  bool get _isAdmin => widget.authController.session?.user.role == 'admin';

  @override
  Widget build(BuildContext context) {
    final user = widget.authController.session?.user;
    final role = user?.role?.trim();
    return Scaffold(
      appBar: AppBar(title: const Text('Einstellungen')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('App', style: Theme.of(context).textTheme.titleMedium),
          const ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('Monopol Musix Vault'),
            subtitle: Text('Version 0.4.0 (Build 4)'),
          ),
          const Divider(),
          Text('Konto', style: Theme.of(context).textTheme.titleMedium),
          ListTile(
            leading: const Icon(Icons.account_circle_outlined),
            title: Text(user?.email ?? 'Unbekanntes Konto'),
            subtitle: Text(
              'Rolle: ${role?.isNotEmpty == true ? role : 'Benutzer'}',
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dns_outlined),
            title: const Text('Server'),
            subtitle: SelectableText(widget.authController.serverLabel),
          ),
          const Divider(),
          Text('Anzeige', style: Theme.of(context).textTheme.titleMedium),
          SwitchListTile(
            secondary: const Icon(Icons.hub_outlined),
            title: const Text('Kompakte Graphansicht'),
            subtitle: const Text('Nur auf diesem Gerät und für diese Sitzung.'),
            value: _compactGraph,
            onChanged: (value) => setState(() => _compactGraph = value),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.playlist_add_check),
            title: const Text('Queue-Änderungen bestätigen'),
            subtitle: const Text('Lokale Einstellung für diese Sitzung.'),
            value: _confirmQueueChanges,
            onChanged: (value) => setState(() => _confirmQueueChanges = value),
          ),
          if (_isAdmin) ...[
            const Divider(),
            Text('Admin', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Brain-Verwaltung',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Synchronisiert den Brain-Inhalt mit dem Vault. Diese Aktion ist nur für Administratoren verfügbar.',
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        FilledButton.icon(
                          onPressed: _syncing ? null : _syncBrain,
                          icon: _syncing
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.sync),
                          label: const Text('Brain Sync'),
                        ),
                        OutlinedButton.icon(
                          onPressed: widget.onOpenBrain,
                          icon: const Icon(Icons.hub_outlined),
                          label: const Text('Graph öffnen'),
                        ),
                      ],
                    ),
                    if (_syncResult case final result?) ...[
                      const SizedBox(height: 16),
                      _SyncResultView(result: result),
                    ],
                    if (_syncError case final error?) ...[
                      const SizedBox(height: 16),
                      _SyncErrorView(error: error),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _syncBrain() async {
    setState(() {
      _syncing = true;
      _syncResult = null;
      _syncError = null;
    });
    try {
      final result = await widget.authController.syncBrain();
      if (mounted) setState(() => _syncResult = result);
    } catch (error) {
      if (mounted) setState(() => _syncError = error);
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }
}

final class _SyncResultView extends StatelessWidget {
  const _SyncResultView({required this.result});

  final BrainSyncResult result;

  @override
  Widget build(BuildContext context) {
    final counts = result.counts;
    final hasErrors = result.errors.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(hasErrors ? Icons.warning_amber : Icons.check_circle_outline),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                hasErrors
                    ? 'Sync mit Fehlern abgeschlossen'
                    : 'Sync abgeschlossen',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text('Titel: ${counts.tracks}'),
        Text('Künstler: ${counts.artists}'),
        Text('Alben: ${counts.albums}'),
        Text('Genres: ${counts.genres}'),
        Text('Fehler: ${result.errors.length}'),
        for (final error in result.errors)
          ListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            leading: const Icon(Icons.error_outline),
            title: Text(error.message),
            subtitle: error.noteId == null
                ? null
                : Text('${error.noteType ?? 'note'} • ${error.noteId}'),
          ),
      ],
    );
  }
}

final class _SyncErrorView extends StatelessWidget {
  const _SyncErrorView({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final apiError = error is ApiException ? error as ApiException : null;
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Brain Sync fehlgeschlagen',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(apiError?.message ?? error.toString()),
            if (apiError != null)
              Text(
                'HTTP-Status: ${apiError.statusCode}${apiError.code == null ? '' : ' • Code: ${apiError.code}'}',
              ),
          ],
        ),
      ),
    );
  }
}
