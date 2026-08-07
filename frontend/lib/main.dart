import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';

import 'src/app/musix_vault_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  runApp(MusixVaultApp.bootstrap());
}
