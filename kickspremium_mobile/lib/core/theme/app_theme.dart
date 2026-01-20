import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color black = Color(0xFF0A0A0A);
  static const Color dark = Color(0xFF141414);
  static const Color gray = Color(0xFF1C1C1C);
  static const Color red = Color(0xFFFF3131);
  static const Color accent = Color(0xFF00D4FF);
  
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: black,
      primaryColor: red,
      colorScheme: const ColorScheme.dark(
        primary: red,
        secondary: accent,
        surface: dark,
        background: black,
        onBackground: Colors.white,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.bebasNeue(
          fontSize: 48,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.0,
        ),
        displayMedium: GoogleFonts.bebasNeue(
          fontSize: 32,
          fontWeight: FontWeight.bold,
        ),
        headlineLarge: GoogleFonts.oswald(
          fontSize: 28,
          fontWeight: FontWeight.w600,
        ),
        titleLarge: GoogleFonts.inter(
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: 16,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 14,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: black,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: red,
          foregroundColor: Colors.white,
          textStyle: GoogleFonts.bebasNeue(fontSize: 18),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        ),
      ),
    );
  }
}
