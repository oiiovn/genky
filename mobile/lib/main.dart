import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/dashboard_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const GenkyApp());
}

class GenkyApp extends StatelessWidget {
  const GenkyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Genky HRM',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light.copyWith(
        textTheme: GoogleFonts.plusJakartaSansTextTheme(
          AppTheme.light.textTheme,
        ),
      ),
      home: const DashboardScreen(),
    );
  }
}
