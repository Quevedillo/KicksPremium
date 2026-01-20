class UserProfile {
  final String id;
  final String email;
  final String? fullName;
  final bool isAdmin;

  UserProfile({
    required this.id,
    required this.email,
    this.fullName,
    required this.isAdmin,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['full_name'] as String?,
      isAdmin: json['is_admin'] as bool? ?? false,
    );
  }
}
