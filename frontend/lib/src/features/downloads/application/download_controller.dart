import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../library/domain/catalog_track.dart';
import '../../player/domain/playback_source.dart';
import '../domain/downloaded_track.dart';

enum DownloadState { downloading, failed }

final class DownloadProgress {
  const DownloadProgress({required this.state, this.fraction});
  final DownloadState state;
  final double? fraction;
}

final class DownloadController extends ChangeNotifier {
  DownloadController({required this.authController});

  final AuthController authController;
  final Map<String, DownloadedTrack> _items = {};
  final Map<String, DownloadProgress> _progress = {};
  Directory? _directory;
  Future<void>? _initialization;

  List<DownloadedTrack> get downloads {
    final result = _items.values.toList();
    result.sort((a, b) => b.downloadedAt.compareTo(a.downloadedAt));
    return result;
  }

  DownloadedTrack? downloaded(String trackId) => _items[trackId];
  DownloadProgress? progress(String trackId) => _progress[trackId];

  Future<void> initialize() => _initialization ??= _load();

  Future<void> _load() async {
    final support = await getApplicationSupportDirectory();
    _directory = Directory('${support.path}${Platform.pathSeparator}downloads');
    await _directory!.create(recursive: true);
    final index = _indexFile;
    if (!await index.exists()) return;
    final raw = jsonDecode(await index.readAsString());
    if (raw is! Map) return;
    final parsed = DownloadIndex.fromJson(Map<String, Object?>.from(raw));
    var changed = false;
    for (final item in parsed.items) {
      if (await File(item.localPath).exists()) {
        _items[item.track.id] = item;
      } else {
        changed = true;
      }
    }
    if (changed) await _persist();
    notifyListeners();
  }

  Future<void> download(CatalogTrack track) async {
    await initialize();
    if (_items.containsKey(track.id) ||
        _progress[track.id]?.state == DownloadState.downloading) {
      return;
    }
    _progress[track.id] = const DownloadProgress(
      state: DownloadState.downloading,
    );
    notifyListeners();
    final part = File(
      '${_directory!.path}${Platform.pathSeparator}${track.id}.audio.part',
    );
    final target = File(
      '${_directory!.path}${Platform.pathSeparator}${track.id}.audio',
    );
    IOSink? sink;
    try {
      if (await part.exists()) await part.delete();
      sink = part.openWrite();
      final size = await authController.downloadTrack(
        track.id,
        sink,
        onProgress: (received, total) {
          _progress[track.id] = DownloadProgress(
            state: DownloadState.downloading,
            fraction: total == null || total <= 0 ? null : received / total,
          );
          notifyListeners();
        },
      );
      await sink.flush();
      await sink.close();
      sink = null;
      if (await target.exists()) await target.delete();
      await part.rename(target.path);
      _items[track.id] = DownloadedTrack(
        track: track,
        localPath: target.path,
        sizeBytes: size,
        downloadedAt: DateTime.now().toUtc(),
      );
      _progress.remove(track.id);
      await _persist();
    } catch (_) {
      await sink?.close();
      if (await part.exists()) await part.delete();
      _progress[track.id] = const DownloadProgress(state: DownloadState.failed);
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  Future<void> delete(String trackId) async {
    await initialize();
    final item = _items.remove(trackId);
    _progress.remove(trackId);
    if (item == null) return;
    final file = File(item.localPath);
    if (await file.exists()) await file.delete();
    await _persist();
    notifyListeners();
  }

  List<PlaybackSource> localPlaybackSources() => downloads
      .map(
        (item) => PlaybackSource(
          track: item.track,
          uri: File(item.localPath).uri,
          headers: const {},
        ),
      )
      .toList(growable: false);

  File get _indexFile =>
      File('${_directory!.path}${Platform.pathSeparator}index.json');

  Future<void> _persist() async {
    final target = _indexFile;
    final temporary = File('${target.path}.part');
    await temporary.writeAsString(
      jsonEncode(DownloadIndex(items: downloads).toJson()),
      flush: true,
    );
    if (await target.exists()) await target.delete();
    await temporary.rename(target.path);
  }
}
