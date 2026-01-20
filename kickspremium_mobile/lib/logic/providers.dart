import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/repositories/product_repository.dart';
import '../data/models/product.dart';
import '../data/models/category.dart';

// Clients
final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

// Repositories
final productRepositoryProvider = Provider<ProductRepository>((ref) {
  return ProductRepository(ref.watch(supabaseClientProvider));
});

// Auth State
final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(supabaseClientProvider).auth.onAuthStateChange;
});

final userProvider = Provider<User?>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.value?.session?.user;
});

// Data Providers
final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  return ref.watch(productRepositoryProvider).getCategories();
});

final productsProvider = FutureProvider.family<List<Product>, String?>((ref, categorySlug) async {
  return ref.watch(productRepositoryProvider).getProducts(categorySlug: categorySlug);
});

final featuredProductsProvider = FutureProvider<List<Product>>((ref) async {
  final products = await ref.watch(productRepositoryProvider).getProducts();
  return products.where((p) => p.isFeatured).toList();
});
