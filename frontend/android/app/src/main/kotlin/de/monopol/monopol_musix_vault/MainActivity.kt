package de.monopol.monopol_musix_vault

import android.Manifest
import android.content.ContentUris
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.net.Uri

import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.util.concurrent.Executors

class MainActivity : AudioServiceActivity() {
    private val channelName = "de.monopol.musix_vault/local_music"
    private val permissionRequestCode = 9042
    private val notificationPermissionRequestCode = 9043
    private var pendingResult: MethodChannel.Result? = null
    private val mediaStoreExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                notificationPermissionRequestCode,
            )
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler(::handleLocalMusicCall)
    }

    private fun handleLocalMusicCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "listAudio" -> requestAudioList(result)
            "prepareAudio" -> prepareAudioAsync(call, result)
            else -> result.notImplemented()
        }
    }

    private fun requestAudioList(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            queryAudioAsync(result)
            return
        }
        val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
        if (checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
            queryAudioAsync(result)
            return
        }
        if (pendingResult != null) {
            result.error("REQUEST_ACTIVE", "Eine Berechtigungsanfrage läuft bereits.", null)
            return
        }
        pendingResult = result
        requestPermissions(arrayOf(permission), permissionRequestCode)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != permissionRequestCode) return
        val result = pendingResult ?: return
        pendingResult = null
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            queryAudioAsync(result)
        } else {
            result.error(
                "PERMISSION_DENIED",
                "Zugriff auf lokale Audiodateien wurde nicht erlaubt.",
                null,
            )
        }
    }

    override fun onDestroy() {
        mediaStoreExecutor.shutdownNow()
        pendingResult = null
        super.onDestroy()
    }

    private fun prepareAudioAsync(call: MethodCall, result: MethodChannel.Result) {
        val contentUri = call.argument<String>("contentUri")?.let(Uri::parse)
        val mediaId = call.argument<String>("mediaId")
        if (
            contentUri?.scheme != "content" ||
            contentUri.authority != "media" ||
            mediaId == null ||
            !mediaId.matches(Regex("[0-9]+"))
        ) {
            result.error("INVALID_MEDIA", "Ungültiger lokaler Titel.", null)
            return
        }
        mediaStoreExecutor.execute {
            val directory = File(cacheDir, "local-playback").apply { mkdirs() }
            val target = File(directory, "local-$mediaId.audio")
            val temporary = File(directory, "local-$mediaId.audio.part")
            try {
                if (temporary.exists()) temporary.delete()
                val copied = contentResolver.openInputStream(contentUri)?.use { input ->
                    temporary.outputStream().buffered().use { output -> input.copyTo(output) }
                } ?: throw IllegalStateException("Audio stream unavailable")
                if (copied <= 0L) throw IllegalStateException("Empty audio stream")
                if (target.exists() && !target.delete()) {
                    throw IllegalStateException("Old cache file cannot be replaced")
                }
                if (!temporary.renameTo(target)) {
                    throw IllegalStateException("Audio cache cannot be completed")
                }
                runOnUiThread { result.success(target.absolutePath) }
            } catch (error: Exception) {
                temporary.delete()
                runOnUiThread {
                    result.error(
                        "PREPARE_FAILED",
                        "Lokaler Titel konnte nicht vorbereitet werden.",
                        null,
                    )
                }
            }
        }
    }

    private fun queryAudioAsync(result: MethodChannel.Result) {
        mediaStoreExecutor.execute {
            try {
                val tracks = queryAudio()
                runOnUiThread { result.success(tracks) }
            } catch (error: Exception) {
                runOnUiThread {
                    result.error(
                        "MEDIASTORE_ERROR",
                        "Lokale Musik konnte nicht gelesen werden.",
                        null,
                    )
                }
            }
        }
    }

    private fun queryAudio(): List<Map<String, Any?>> {
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DISPLAY_NAME,
        )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} > 0 AND ${MediaStore.Audio.Media.DISPLAY_NAME} NOT LIKE ?"
        val tracks = mutableListOf<Map<String, Any?>>()
        contentResolver.query(
            collection,
            projection,
            selection,
            arrayOf("AUD%"),
            "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC",
        )?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idColumn)
                tracks += mapOf(
                    "id" to id,
                    "title" to cursor.getString(titleColumn),
                    "artist" to cursor.getString(artistColumn),
                    "album" to cursor.getString(albumColumn),
                    "durationMs" to cursor.getLong(durationColumn),
                    "contentUri" to ContentUris.withAppendedId(collection, id).toString(),
                )
            }
        }
        return tracks
    }
}
