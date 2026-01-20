import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'presentation/router.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await dotenv.load(fileName: "assets/env");

    final supabaseUrl = dotenv.env['PUBLIC_SUPABASE_URL'];
    final supabaseKey = dotenv.env['PUBLIC_SUPABASE_ANON_KEY'];

    if (supabaseUrl != null && supabaseKey != null && supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty) {
      await Supabase.initialize(
        url: supabaseUrl,
        anonKey: supabaseKey,
      );
    } else {
      print('❌ Warning: Supabase credentials not found in assets/env');
    }
  } catch (e) {
    print('❌ Error during initialization: $e');
  }

  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'KicksPremium',
      theme: AppTheme.darkTheme,
      routerConfig: goRouter,
    );
  }
}
