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
  final user = ref.watch(userProvider);
  if (user == null) return null;
  return ref.watch(authRepositoryProvider).getUserProfile();
});

final isAdminProvider = FutureProvider<bool>((ref) async {
  final user = ref.watch(userProvider);
  if (user == null) return false;
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
  final user = ref.watch(userProvider);
  if (user == null) return [];
  ref.watch(authStateProvider);
  return ref.watch(orderRepositoryProvider).getUserOrders();
});

// ========== Cart State ==========
class CartNotifier extends Notifier<List<CartItem>> {
  @override
  List<CartItem> build() => [];

  void addItem(Product product, String size, int quantity) {
    if (quantity <= 0) return;
    if (!product.sizesAvailable.containsKey(size)) return;
    
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
      final maxStock = _getStockForSize(product, size);
      final finalQuantity = quantity > maxStock ? maxStock : quantity;
      state = [
        ...state,
        CartItem(
          productId: product.id,
          product: product,
          quantity: finalQuantity,
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
    if (!product.sizesAvailable.containsKey(size)) return 0;
    final stock = product.sizesAvailable[size];
    if (stock is int) return stock;
    if (stock is String) return int.tryParse(stock) ?? 0;
    return 0;
  }
}

final cartProvider = NotifierProvider<CartNotifier, List<CartItem>>(
  CartNotifier.new,
);

final cartTotalProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider);
  int total = 0;
  for (final item in cart) {
    total += (item.product.price * item.quantity).toInt();
  }
  return total;
});

final cartItemCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider);
  int count = 0;
  for (final item in cart) {
    count += item.quantity;
  }
  return count;
});

final cartOpenProvider = NotifierProvider<CartOpenNotifier, bool>(
  CartOpenNotifier.new,
);

class CartOpenNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void toggle() => state = !state;
  void setOpen(bool value) => state = value;
}

// ========== Search State ==========
class SearchQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  void setQuery(String query) => state = query;
  void clear() => state = '';
}

final searchQueryProvider = NotifierProvider<SearchQueryNotifier, String>(
  SearchQueryNotifier.new,
);

final searchResultsProvider = FutureProvider<List<Product>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.isEmpty) return [];
  return ref.watch(productRepositoryProvider).searchProducts(query);
});
