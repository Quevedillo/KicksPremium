import 'package:supabase_flutter/supabase_flutter.dart';

class AuthRepository {
  final SupabaseClient _client;

  AuthRepository(this._client);

  User? get currentUser => _client.auth.currentUser;
  
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    String? fullName,
  }) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      data: fullName != null ? {'full_name': fullName} : null,
    );
    
    // Crear perfil de usuario si el registro fue exitoso
    if (response.user != null) {
      await _createUserProfile(response.user!, fullName);
    }
    
    return response;
  }

  Future<void> _createUserProfile(User user, String? fullName) async {
    try {
      await _client.from('user_profiles').upsert({
        'id': user.id,
        'email': user.email,
        'full_name': fullName,
        'is_admin': false,
        'created_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Error creating user profile: $e');
    }
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  Future<UserResponse> updatePassword(String newPassword) async {
    return await _client.auth.updateUser(
      UserAttributes(password: newPassword),
    );
  }

  Future<Map<String, dynamic>?> getUserProfile() async {
    final user = currentUser;
    if (user == null) return null;

    final response = await _client
        .from('user_profiles')
        .select()
        .eq('id', user.id)
        .maybeSingle();

    return response;
  }

  Future<bool> isAdmin() async {
    final profile = await getUserProfile();
    return profile?['is_admin'] == true;
  }
}
