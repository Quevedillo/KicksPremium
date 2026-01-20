import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../logic/providers.dart';
import '../../widgets/product_card.dart';

class CategoryScreen extends ConsumerWidget {
  final String slug;

  const CategoryScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final productsAsync = ref.watch(productsProvider(slug));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
        title: categoriesAsync.when(
          data: (categories) {
            final category = categories.where((c) => c.slug == slug).firstOrNull;
            return Text(
              category?.name.toUpperCase() ?? 'CATEGORÍA',
              style: const TextStyle(fontWeight: FontWeight.bold),
            );
          },
          loading: () => const Text('CARGANDO...'),
          error: (_, __) => const Text('CATEGORÍA'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: () => context.push('/cart'),
          ),
        ],
      ),
      body: productsAsync.when(
        data: (products) {
          if (products.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.inventory_2_outlined,
                    size: 64,
                    color: Colors.grey,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No hay productos disponibles',
                    style: TextStyle(
                      color: Colors.grey,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => context.go('/'),
                    child: const Text('VER TODO EL CATÁLOGO'),
                  ),
                ],
              ),
            );
          }

          return CustomScrollView(
            slivers: [
              // Category info
              SliverToBoxAdapter(
                child: categoriesAsync.when(
                  data: (categories) {
                    final category = categories.where((c) => c.slug == slug).firstOrNull;
                    if (category == null) return const SizedBox.shrink();
                    
                    return Container(
                      padding: const EdgeInsets.all(16),
                      color: Theme.of(context).colorScheme.surface,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (category.icon != null)
                                Text(
                                  category.icon!,
                                  style: const TextStyle(fontSize: 32),
                                ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      category.name.toUpperCase(),
                                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      '${products.length} productos disponibles',
                                      style: const TextStyle(color: Colors.grey),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          if (category.description != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              category.description!,
                              style: const TextStyle(color: Colors.grey),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ),

              // Product count
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverToBoxAdapter(
                  child: Text(
                    'PRODUCTOS (${products.length})',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Colors.grey,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),

              // Products grid
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    childAspectRatio: 0.7,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final product = products[index];
                      return ProductCard(
                        product: product,
                        onTap: () => context.push('/product/${product.slug}'),
                      );
                    },
                    childCount: products.length,
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 32)),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text('Error: $err'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh(productsProvider(slug)),
                child: const Text('REINTENTAR'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
