import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../logic/providers.dart';
import '../widgets/product_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final productsAsync = ref.watch(productsProvider(null));
    final user = ref.watch(userProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'KICKS PREMIUM',
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
            color: Theme.of(context).primaryColor,
            fontSize: 24,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => _showSearchDialog(context, ref),
          ),
          if (user == null)
            TextButton(
              onPressed: () => context.push('/login'),
              child: Text(
                'ENTRAR',
                style: TextStyle(
                  color: Theme.of(context).primaryColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(productsProvider(null));
          ref.invalidate(categoriesProvider);
        },
        child: CustomScrollView(
          slivers: [
            // Hero Banner
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.all(16),
                height: 200,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LinearGradient(
                    colors: [Colors.grey[900]!, Colors.black],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  children: [
                    // Pattern background
                    Positioned.fill(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Opacity(
                          opacity: 0.3,
                          child: Image.network(
                            "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80",
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const SizedBox(),
                          ),
                        ),
                      ),
                    ),
                    // Content
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Theme.of(context).primaryColor,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'EXCLUSIVELY LIMITED',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'SNEAKERS\nEXCLUSIVOS',
                            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                              color: Colors.white,
                              fontSize: 32,
                              height: 1,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: () {},
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            ),
                            child: const Text('EXPLORAR'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Brands bar
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                color: const Color(0xFF1C1C1C),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      'Travis Scott',
                      'Jordan Special',
                      'Adidas Collab',
                      'Nike Rare',
                      'Yeezy SZN',
                    ].map((brand) => Padding(
                      padding: const EdgeInsets.only(right: 24),
                      child: Text(
                        brand.toUpperCase(),
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          letterSpacing: 1,
                        ),
                      ),
                    )).toList(),
                  ),
                ),
              ),
            ),

            // Categories Section
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'COLECCIONES',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const Text(
                          'Piezas exclusivas y únicas',
                          style: TextStyle(color: Colors.grey, fontSize: 12),
                        ),
                      ],
                    ),
                    TextButton(
                      onPressed: () {},
                      child: Text(
                        'VER TODO →',
                        style: TextStyle(
                          color: Theme.of(context).primaryColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Categories horizontal list
            SliverToBoxAdapter(
              child: SizedBox(
                height: 120,
                child: categoriesAsync.when(
                  data: (categories) => ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final cat = categories[index];
                      return GestureDetector(
                        onTap: () => context.push('/category/${cat.slug}'),
                        child: Container(
                          width: 140,
                          decoration: BoxDecoration(
                            color: const Color(0xFF1C1C1C),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Stack(
                            children: [
                              // Icon background
                              if (cat.icon != null)
                                Positioned(
                                  right: -10,
                                  top: -10,
                                  child: Opacity(
                                    opacity: 0.2,
                                    child: Text(
                                      cat.icon!,
                                      style: const TextStyle(fontSize: 80),
                                    ),
                                  ),
                                ),
                              // Content
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Text(
                                      cat.name.toUpperCase(),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Ver más →',
                                      style: TextStyle(
                                        color: Theme.of(context).primaryColor,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (err, _) => Center(child: Text('Error: $err')),
                ),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // Products section header
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'HOT RIGHT NOW',
                          style: TextStyle(
                            color: Theme.of(context).primaryColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'DESTACADOS',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    TextButton(
                      onPressed: () {},
                      child: Text(
                        'VER TODO →',
                        style: TextStyle(
                          color: Theme.of(context).primaryColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 16)),

            // Product Grid
            productsAsync.when(
              data: (products) {
                if (products.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Column(
                          children: [
                            Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey),
                            SizedBox(height: 16),
                            Text(
                              'No hay productos disponibles',
                              style: TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 16,
                      crossAxisSpacing: 16,
                      childAspectRatio: 0.68,
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
                );
              },
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (err, _) => SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 16),
                      Text('Error: $err'),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => ref.refresh(productsProvider(null)),
                        child: const Text('REINTENTAR'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // USP Section
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _UspItem(
                            icon: Icons.verified,
                            title: '100% Auténtico',
                            subtitle: 'Verificado',
                          ),
                        ),
                        Expanded(
                          child: _UspItem(
                            icon: Icons.local_shipping,
                            title: 'Envío Express',
                            subtitle: '24-48h',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _UspItem(
                            icon: Icons.sync,
                            title: 'Devolución',
                            subtitle: '30 días',
                          ),
                        ),
                        Expanded(
                          child: _UspItem(
                            icon: Icons.security,
                            title: 'Pago Seguro',
                            subtitle: 'SSL',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  void _showSearchDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1C1C1C),
        title: const Text('Buscar'),
        content: TextField(
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Buscar sneakers...',
            prefixIcon: const Icon(Icons.search),
            filled: true,
            fillColor: const Color(0xFF0A0A0A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide.none,
            ),
          ),
          onSubmitted: (query) {
            Navigator.of(ctx).pop();
            // TODO: Implement search screen
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Buscando: $query')),
            );
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('CANCELAR'),
          ),
        ],
      ),
    );
  }
}

class _UspItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _UspItem({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 28),
        const SizedBox(height: 8),
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
          textAlign: TextAlign.center,
        ),
        Text(
          subtitle,
          style: TextStyle(
            color: Colors.white.withOpacity(0.8),
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}
