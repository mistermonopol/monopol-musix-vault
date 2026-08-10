import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/api/api_client.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../user_data/domain/user_data_models.dart';
import '../domain/artwork_lookup_progress.dart';

final class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    required this.authController,
    required this.onOpenBrain,
    required this.onArtworkLookupCompleted,
    super.key,
  });

  final AuthController authController;
  final VoidCallback onOpenBrain;
  final VoidCallback onArtworkLookupCompleted;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

final class _SettingsScreenState extends State<SettingsScreen> {
  bool _compactGraph = false;
  bool _confirmQueueChanges = true;
  bool _syncing = false;
  BrainSyncResult? _syncResult;
  Object? _syncError;
  ArtworkLookupProgress? _artworkProgress;
  Object? _artworkError;
  bool _artworkRequestPending = false;
  Timer? _artworkPollTimer;
  bool _completionHandled = false;

  bool get _isAdmin => widget.authController.session?.user.role == 'admin';

  @override
  void initState() {
    super.initState();
    if (_isAdmin) unawaited(_loadArtworkStatus());
  }

  @override
  void dispose() {
    _artworkPollTimer?.cancel();
    super.dispose();
  }

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
            subtitle: Text('Version 0.7.0 (Build 7)'),
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
            _ArtworkLookupCard(
              progress: _artworkProgress,
              error: _artworkError,
              requestPending: _artworkRequestPending,
              onStart: () => _startArtworkLookup(retry: false),
              onRetry: () => _startArtworkLookup(retry: true),
            ),
            const SizedBox(height: 12),
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

  Future<void> _loadArtworkStatus() async {
    try {
      final progress = await widget.authController.getArtworkLookupStatus();
      if (!mounted) return;
      _applyArtworkProgress(progress);
    } catch (error) {
      if (mounted) setState(() => _artworkError = error);
    }
  }

  Future<void> _startArtworkLookup({required bool retry}) async {
    _artworkPollTimer?.cancel();
    setState(() {
      _artworkRequestPending = true;
      _artworkError = null;
      _completionHandled = false;
    });
    try {
      final progress = await widget.authController.startArtworkLookup(
        retry: retry,
      );
      if (mounted) _applyArtworkProgress(progress);
    } on ApiException catch (error) {
      if (error.code == 'ARTWORK_LOOKUP_IN_PROGRESS') {
        await _loadArtworkStatus();
      } else if (mounted) {
        setState(() => _artworkError = error);
      }
    } catch (error) {
      if (mounted) setState(() => _artworkError = error);
    } finally {
      if (mounted) setState(() => _artworkRequestPending = false);
    }
  }

  void _applyArtworkProgress(ArtworkLookupProgress progress) {
    _artworkPollTimer?.cancel();
    setState(() {
      _artworkProgress = progress;
      _artworkError = null;
    });
    if (progress.isRunning) {
      _artworkPollTimer = Timer(const Duration(seconds: 2), _loadArtworkStatus);
    } else if (progress.state == ArtworkLookupState.completed &&
        !_completionHandled) {
      _completionHandled = true;
      widget.onArtworkLookupCompleted();
    }
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

final class _ArtworkLookupCard extends StatelessWidget {
  const _ArtworkLookupCard({
    required this.progress,
    required this.error,
    required this.requestPending,
    required this.onStart,
    required this.onRetry,
  });

  final ArtworkLookupProgress? progress;
  final Object? error;
  final bool requestPending;
  final VoidCallback onStart;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final current = progress;
    final running = current?.isRunning ?? false;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Fehlende Cover suchen',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            const Text(
              'Sucht automatisch nach Covern für Alben ohne Artwork. „Erneut versuchen“ berücksichtigt auch frühere Suchversuche.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: running || requestPending ? null : onStart,
                  icon: running || requestPending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.image_search_outlined),
                  label: Text(running ? 'Suche läuft' : 'Suche starten'),
                ),
                OutlinedButton.icon(
                  onPressed: running || requestPending ? null : onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Erneut versuchen'),
                ),
              ],
            ),
            if (current != null) ...[
              const SizedBox(height: 16),
              _ArtworkProgressView(progress: current),
            ],
            if (error != null) ...[
              const SizedBox(height: 12),
              _OperationErrorView(
                title: 'Cover-Suche fehlgeschlagen',
                error: error!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

final class _ArtworkProgressView extends StatelessWidget {
  const _ArtworkProgressView({required this.progress});

  final ArtworkLookupProgress progress;

  @override
  Widget build(BuildContext context) {
    final status = switch (progress.state) {
      ArtworkLookupState.idle => 'Noch nicht gestartet',
      ArtworkLookupState.running => 'Suche läuft',
      ArtworkLookupState.completed =>
        progress.errors.isEmpty
            ? 'Suche abgeschlossen'
            : 'Suche mit Fehlern abgeschlossen',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(status, style: Theme.of(context).textTheme.titleSmall),
        if (progress.isRunning) ...[
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress.queued > 0
                ? (progress.attempted / progress.queued).clamp(0, 1)
                : null,
          ),
        ],
        const SizedBox(height: 8),
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            Text('Warteschlange: ${progress.queued}'),
            Text('Geprüft: ${progress.attempted}'),
            Text('Treffer: ${progress.matched}'),
            Text('Cover gesetzt: ${progress.coversApplied}'),
            Text('Titel aktualisiert: ${progress.tracksUpdated}'),
            Text('Kein Treffer: ${progress.noMatch}'),
            Text('Kein Cover: ${progress.noCover}'),
            Text('Fehlgeschlagen: ${progress.failed}'),
          ],
        ),
        for (final message in progress.errors)
          ListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            leading: const Icon(Icons.error_outline),
            title: Text(message),
          ),
      ],
    );
  }
}

final class _OperationErrorView extends StatelessWidget {
  const _OperationErrorView({required this.title, required this.error});

  final String title;
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
            Text(title, style: Theme.of(context).textTheme.titleSmall),
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
