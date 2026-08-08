import 'package:flutter/material.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../player/presentation/audio_player_controller.dart';
import '../../user_data/domain/user_data_models.dart';

final class DevicesScreen extends StatefulWidget {
  const DevicesScreen({
    required this.authController,
    required this.audioController,
    super.key,
  });
  final AuthController authController;
  final AudioPlayerController audioController;
  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

final class _DevicesScreenState extends State<DevicesScreen> {
  List<VaultDevice> _devices = const [];
  bool _loading = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      _content(),
      Positioned(
        right: 18,
        bottom: 18,
        child: FloatingActionButton.extended(
          onPressed: _register,
          icon: const Icon(Icons.add),
          label: const Text('Gerät'),
        ),
      ),
    ],
  );
  Widget _content() {
    if (_loading && _devices.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error case final error?) return Center(child: Text(error));
    if (_devices.isEmpty) {
      return const Center(child: Text('Keine Geräte registriert.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 88),
        itemCount: _devices.length,
        itemBuilder: (context, index) {
          final device = _devices[index];
          return Card(
            child: ListTile(
              leading: Icon(_icon(device.kind)),
              title: Text(device.name),
              subtitle: Text(
                '${device.kind} • zuletzt ${_date(device.lastSeenAt)}',
              ),
              trailing: PopupMenuButton<String>(
                onSelected: (action) {
                  if (action == 'save') _saveQueue(device);
                  if (action == 'transfer') _transfer(device);
                  if (action == 'delete') _delete(device);
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(
                    value: 'save',
                    child: Text('Aktuelle Queue speichern'),
                  ),
                  const PopupMenuItem(
                    value: 'transfer',
                    child: Text('Queue übertragen…'),
                  ),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Gerät widerrufen'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final devices = await widget.authController.listDevices();
      if (mounted) setState(() => _devices = devices);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _register() async {
    final name = TextEditingController();
    final kind = TextEditingController(text: 'flutter');
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Gerät registrieren'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: kind,
              decoration: const InputDecoration(labelText: 'Typ'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Registrieren'),
          ),
        ],
      ),
    );
    if (save != true || name.text.trim().isEmpty) return;
    try {
      await widget.authController.registerDevice(
        name.text.trim(),
        kind.text.trim().isEmpty ? 'flutter' : kind.text.trim(),
      );
      await _load();
    } catch (error) {
      _show(error);
    }
  }

  Future<void> _saveQueue(VaultDevice device) async {
    try {
      await widget.authController.saveQueue(
        device.id,
        widget.audioController.queueTrackIds,
        widget.audioController.currentIndex,
        widget.audioController.position.inMilliseconds / 1000,
      );
      _show('Queue auf ${device.name} gespeichert.');
    } catch (error) {
      _show(error);
    }
  }

  Future<void> _transfer(VaultDevice source) async {
    final targets = _devices.where((device) => device.id != source.id).toList();
    if (targets.isEmpty) {
      _show('Registriere zuerst ein zweites Gerät.');
      return;
    }
    VaultDevice target = targets.first;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Queue übertragen'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Quelle: ${source.name}'),
              const SizedBox(height: 12),
              DropdownButtonFormField<VaultDevice>(
                initialValue: target,
                decoration: const InputDecoration(labelText: 'Zielgerät'),
                items: [
                  for (final device in targets)
                    DropdownMenuItem(value: device, child: Text(device.name)),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => target = value);
                },
              ),
              const SizedBox(height: 16),
              const Text(
                'Die Queue wird nur kopiert. Die Wiedergabe startet nicht automatisch.',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Jetzt übertragen'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    try {
      final result = await widget.authController.transferQueue(
        source.id,
        target.id,
      );
      if (result.autoPlay) {
        _show('Transfer abgelehnt: Server forderte Autoplay an.');
        return;
      }
      _show('Queue übertragen. Wiedergabe bleibt pausiert.');
    } catch (error) {
      _show(error);
    }
  }

  Future<void> _delete(VaultDevice device) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Gerät widerrufen?'),
        content: Text(
          '${device.name} und verbundene Sitzungen werden widerrufen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Widerrufen'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.authController.deleteDevice(device.id);
      await _load();
    } catch (error) {
      _show(error);
    }
  }

  IconData _icon(String kind) =>
      kind.contains('phone') || kind.contains('android')
      ? Icons.phone_android
      : Icons.devices;
  String _date(DateTime date) {
    final value = date.toLocal();
    return '${value.day}.${value.month}.${value.year}';
  }

  void _show(Object message) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message.toString())));
    }
  }
}
