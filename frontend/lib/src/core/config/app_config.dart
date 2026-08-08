final class AppConfig {
  const AppConfig({required this.apiBaseUrl});

  factory AppConfig.fromEnvironment() {
    const value = String.fromEnvironment(
      'MMV_API_URL',
      defaultValue: 'https://vault.monopol-ai.de/api/',
    );
    return AppConfig(apiBaseUrl: Uri.parse(value));
  }

  final Uri apiBaseUrl;
}
