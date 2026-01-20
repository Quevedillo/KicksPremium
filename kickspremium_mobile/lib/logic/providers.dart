import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/repositories/product_repository.dart';
import '../data/repositories/auth_repository.dart';
import '../data/repositories/order_repository.dart';
import '../data/models/product.dart';
import '../data/models/category.dart';
import '../data/models/order.dart';
import '../data/models/cart_item.dart';

// ========== Clients ==========
final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

// ========== Repositories ==========
final productRepositoryProvider = Provider<ProductRepository>((ref) {
  return ProductRepository(ref.watch(supabaseClientProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(supabaseClientProvider));
});

final orderRepositoryProvider = Provider<OrderRepository>((ref) {
  return OrderRepository(ref.watch(supabaseClientProvider));
});

// ========== Auth Providers ==========
final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(supabaseClientProvider).auth.onAuthStateChange;
});

final userProvider = Provider<User?>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.value?.session?.user;
});

final isLoggedInProvider = Provider<bool>((ref) {
  return ref.watch(userProvider) != null;
});

final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  return ref.watch(authRepositoryProvider).getUserProfile();
});

final isAdminProvider = FutureProvider<bool>((ref) async {
  return ref.watch(authRepositoryProvider).isAdmin();
});

// ========== Product Providers ==========
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

final productBySlugProvider = FutureProvider.family<Product?, String>((ref, slug) async {
  return ref.watch(productRepositoryProvider).getProductBySlug(slug);
});

// ========== Order Providers ==========
final userOrdersProvider = FutureProvider<List<Order>>((ref) async {
  ref.watch(authStateProvider);
  return ref.watch(orderRepositoryProvider).getUserOrders();
});

// ========== Cart State ==========
class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super([]);

  void addItem(Product product, String size, int quantity) {
    final existingIndex = state.indexWhere(
      (item) => item.productId == product.id && item.size == size,
    );

    if (existingIndex >= 0) {
      final existingItem = state[existingIndex];
      final newQuantity = existingItem.quantity + quantity;
      final maxStock = _getStockForSize(product, size);
      final finalQuantity = newQuantity > maxStock ? maxStock : newQuantity;
      
      state = [
        ...state.sublist(0, existingIndex),
        existingItem.copyWith(quantity: finalQuantity),
        ...state.sublist(existingIndex + 1),
      ];
    } else {
      state = [
        ...state,
        CartItem(
          productId: product.id,
          product: product,
          quantity: quantity,
          size: size,
        ),
      ];
    }
  }

  void removeItem(String productId, String size) {
    state = state.where(
      (item) => !(item.productId == productId && item.size == size),
    ).toList();
  }

  void updateQuantity(String productId, String size, int quantity) {
    if (quantity <= 0) {
      removeItem(productId, size);
      return;
    }

    final index = state.indexWhere(
      (item) => item.productId == productId && item.size == size,
    );

    if (index >= 0) {
      final item = state[index];
      final maxStock = item.availableStock;
      final finalQuantity = quantity > maxStock ? maxStock : quantity;
      
      state = [
        ...state.sublist(0, index),
        item.copyWith(quantity: finalQuantity),
        ...state.sublist(index + 1),
      ];
    }
  }

  void clearCart() {
    state = [];
  }

  int _getStockForSize(Product product, String size) {
    final stock = product.sizesAvailable[size];
    if (stock is int) return stock;
    if (stock is String) return int.tryParse(stock) ?? 0;
    return 0;
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>((ref) {
  return CartNotifier();
});

final cartTotalProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider);
  return cart.fold(0, (sum, item) => sum + item.totalPrice);
});

final cartItemCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider);
  return cart.fold(0, (count, item) => count + item.quantity);
});

final cartOpenProvider = StateProvider<bool>((ref) => false);

// ========== Search ==========
final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<Product>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.isEmpty) return [];
  return ref.watch(productRepositoryProvider).searchProducts(query);
});
