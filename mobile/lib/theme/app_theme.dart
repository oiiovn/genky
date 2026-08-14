import 'package:flutter/material.dart';

class AppTheme {
  static const primary = Color(0xFF6366F1);
  static const bg = Color(0xFFF3F4F6);
  static const card = Colors.white;
  static const text = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: bg,
        cardTheme: CardThemeData(
          color: card,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
      );
}
