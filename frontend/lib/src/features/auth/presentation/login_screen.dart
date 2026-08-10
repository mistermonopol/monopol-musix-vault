import 'package:flutter/material.dart';

import 'auth_controller.dart';

final class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.controller, super.key});

  final AuthController controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

final class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _accessCode = TextEditingController();
  bool _bootstrap = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _accessCode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final busy = widget.controller.status == AuthStatus.authenticating;
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.graphic_eq_rounded, size: 54),
                      const SizedBox(height: 16),
                      Text(
                        'Monopol Musix Vault',
                        style: Theme.of(context).textTheme.headlineSmall,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Private Musik. Dein Server.',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 28),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'E-Mail',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                        validator: (value) =>
                            value != null && value.contains('@')
                            ? null
                            : 'Gültige E-Mail eingeben',
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscurePassword,
                        autofillHints: const [AutofillHints.password],
                        decoration: InputDecoration(
                          labelText: 'Passwort',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                          ),
                        ),
                        validator: (value) => (value?.length ?? 0) >= 12
                            ? null
                            : 'Mindestens 12 Zeichen',
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _accessCode,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'API-Zugangscode',
                          prefixIcon: Icon(Icons.key_outlined),
                        ),
                        validator: (value) => (value?.length ?? 0) >= 16
                            ? null
                            : 'Mindestens 16 Zeichen',
                      ),
                      const SizedBox(height: 10),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Ersten Administrator erstellen'),
                        value: _bootstrap,
                        onChanged: busy
                            ? null
                            : (value) => setState(() => _bootstrap = value),
                      ),
                      if (widget.controller.errorMessage
                          case final message?) ...[
                        const SizedBox(height: 8),
                        Text(
                          message,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: busy ? null : _submit,
                        icon: busy
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.login),
                        label: Text(
                          _bootstrap ? 'Administrator erstellen' : 'Anmelden',
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Version 0.8.2 (10) • ${widget.controller.serverLabel}',
                        style: Theme.of(context).textTheme.bodySmall,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    widget.controller.authenticate(
      email: _email.text,
      password: _password.text,
      accessCode: _accessCode.text,
      bootstrap: _bootstrap,
    );
  }
}
