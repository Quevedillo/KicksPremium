import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../data/models/product.dart';
import '../../../logic/providers.dart';

final productBySlugProvider = FutureProvider.family<Product?, String>((ref, slug) async {
  return ref.watch(productRepositoryProvider).getProductBySlug(slug);
});

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String slug;

  const ProductDetailScreen({super.key, required this.slug});

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  String? _selectedSize;
  int _quantity = 1;
  int _currentImageIndex = 0;

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productBySlugProvider(widget.slug));
    final isLoggedIn = ref.watch(isLoggedInProvider);
    final cartItemCount = ref.watch(cartItemCountProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_bag_outlined, color: Colors.white),
                onPressed: () => context.push('/cart'),
              ),
              if (cartItemCount > 0)
                Positioned(
                  right: 6,
                  top: 6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '$cartItemCount',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: productAsync.when(
        data: (product) {
          if (product == null) {
            return const Center(child: Text("Producto no encontrado"));
          }

          final currencyFormat = NumberFormat.currency(locale: 'es_ES', symbol: '€');
          final price = currencyFormat.format(product.price / 100);
          
          // Filtrar solo tallas con stock disponible
          final availableSizes = product.sizesAvailable.entries
              .where((e) {
                final qty = e.value;
                if (qty is int) return qty > 0;
                if (qty is String) return (int.tryParse(qty) ?? 0) > 0;
                return false;
              })
              .map((e) => e.key)
              .toList()
            ..sort((a, b) => double.parse(a).compareTo(double.parse(b)));

          final hasAvailableSizes = availableSizes.isNotEmpty;

          return Column(
            children: [
              // Image Gallery
              Expanded(
                flex: 5,
                child: Stack(
                  children: [
                    // Main image
                    PageView.builder(
                      itemCount: product.images.length,
                      onPageChanged: (index) {
                        setState(() => _currentImageIndex = index);
                      },
                      itemBuilder: (context, index) {
                        return Container(
                          width: double.infinity,
                          decoration: BoxDecoration(color: Colors.grey[900]),
                          child: CachedNetworkImage(
                            imageUrl: product.images[index],
                            fit: BoxFit.cover,
                            placeholder: (_, __) => const Center(
                              child: CircularProgressIndicator(),
                            ),
                            errorWidget: (_, __, ___) => const Icon(Icons.error),
                          ),
                        );
                      },
                    ),
                    
                    // Limited edition badge
                    if (product.isLimitedEdition)
                      Positioned(
                        top: 100,
                        left: 16,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Theme.of(context).primaryColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'LIMITED EDITION',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),

                    // Image indicators
                    if (product.images.length > 1)
                      Positioned(
                        bottom: 16,
                        left: 0,
                        right: 0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(
                            product.images.length,
                            (index) => Container(
                              width: _currentImageIndex == index ? 24 : 8,
                              height: 8,
                              margin: const EdgeInsets.symmetric(horizontal: 2),
                              decoration: BoxDecoration(
                                color: _currentImageIndex == index
                                    ? Theme.of(context).primaryColor
                                    : Colors.white.withOpacity(0.5),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                        ),
                      ),

                    // Gradient overlay
                    const Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Colors.black],
                          ),
                        ),
                        child: SizedBox(height: 80),
                      ),
                    ),
                  ],
                ),
              ),

              // Details section
              Expanded(
                flex: 6,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: Color(0xFF0A0A0A),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Brand & name
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (product.brand != null)
                                    Text(
                                      product.brand!.toUpperCase(),
                                      style: TextStyle(
                                        color: Theme.of(context).primaryColor,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.5,
                                        fontSize: 12,
                                      ),
                                    ),
                                  const SizedBox(height: 4),
                                  Text(
                                    product.name,
                                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  price,
                                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                    color: Theme.of(context).primaryColor,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                if (product.comparePrice != null && product.comparePrice! > product.price)
                                  Text(
                                    currencyFormat.format(product.comparePrice! / 100),
                                    style: const TextStyle(
                                      color: Colors.grey,
                                      decoration: TextDecoration.lineThrough,
                                      fontSize: 14,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),

                        // Stock status
                        Row(
                          children: [
                            if (hasAvailableSizes) ...[
                              const Icon(Icons.check_circle, color: Colors.green, size: 16),
                              const SizedBox(width: 4),
                              const Text(
                                'En stock',
                                style: TextStyle(color: Colors.green, fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${availableSizes.length} tallas disponibles',
                                style: const TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ] else ...[
                              const Icon(Icons.cancel, color: Colors.red, size: 16),
                              const SizedBox(width: 4),
                              const Text(
                                'Agotado',
                                style: TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ],
                        ),

                        const SizedBox(height: 20),

                        // Size selector
                        if (hasAvailableSizes) ...[
                          Text(
                            'SELECCIONA TU TALLA (EU)',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: Colors.grey,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: availableSizes.map((size) {
                              final isSelected = _selectedSize == size;
                              final stock = _getStockForSize(product, size);
                              
                              return GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _selectedSize = size;
                                    _quantity = 1;
                                  });
                                },
                                child: Container(
                                  width: 60,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? Theme.of(context).primaryColor
                                        : const Color(0xFF1C1C1C),
                                    borderRadius: BorderRadius.circular(8),
                                    border: isSelected
                                        ? Border.all(color: Colors.orange, width: 2)
                                        : null,
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        size,
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: isSelected ? Colors.white : Colors.white70,
                                        ),
                                      ),
                                      Text(
                                        '($stock)',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: isSelected ? Colors.white70 : Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),

                          // Selected size info
                          if (_selectedSize != null) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.blue.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.blue.withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.info_outline, color: Colors.blue, size: 16),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Talla $_selectedSize - ${_getStockForSize(product, _selectedSize!)} pares disponibles',
                                    style: const TextStyle(color: Colors.blue, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 16),

                          // Quantity selector
                          if (_selectedSize != null) ...[
                            Text(
                              'CANTIDAD',
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: Colors.grey,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1C1C1C),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove),
                                        onPressed: _quantity > 1
                                            ? () => setState(() => _quantity--)
                                            : null,
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16),
                                        child: Text(
                                          '$_quantity',
                                          style: const TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.add),
                                        onPressed: _quantity < _getStockForSize(product, _selectedSize!)
                                            ? () => setState(() => _quantity++)
                                            : null,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'Máx: ${_getStockForSize(product, _selectedSize!)}',
                                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                                ),
                              ],
                            ),
                          ],
                        ] else
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.red),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.error_outline, color: Colors.red),
                                SizedBox(width: 8),
                                Text(
                                  'Producto Agotado',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),

                        const SizedBox(height: 20),

                        // Description
                        if (product.description != null) ...[
                          Text(
                            'DESCRIPCIÓN',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: Colors.grey,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            product.description!,
                            style: const TextStyle(
                              color: Colors.white70,
                              height: 1.5,
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // Auth warning if not logged in
                        if (!isLoggedIn && hasAvailableSizes)
                          Container(
                            padding: const EdgeInsets.all(12),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1C1C1C),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Theme.of(context).primaryColor.withOpacity(0.3)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline, 
                                  color: Theme.of(context).primaryColor, 
                                  size: 18,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Inicia sesión para añadir al carrito',
                                    style: TextStyle(
                                      color: Colors.grey[300],
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => context.push('/login?redirect=/product/${widget.slug}'),
                                  child: const Text('ENTRAR'),
                                ),
                              ],
                            ),
                          ),

                        // Add to cart button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: hasAvailableSizes
                                ? () => _handleAddToCart(context, product, isLoggedIn)
                                : null,
                            child: Text(
                              hasAvailableSizes
                                  ? (_selectedSize == null 
                                      ? 'SELECCIONA UNA TALLA' 
                                      : 'AÑADIR AL CARRITO')
                                  : 'AGOTADO',
                            ),
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Info badges
                        Row(
                          children: [
                            Expanded(
                              child: _InfoBadge(
                                icon: Icons.local_shipping_outlined,
                                title: 'Envío Express',
                                subtitle: '24-48h',
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _InfoBadge(
                                icon: Icons.verified_outlined,
                                title: '100% Auténtico',
                                subtitle: 'Garantizado',
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }

  int _getStockForSize(Product product, String size) {
    final stock = product.sizesAvailable[size];
    if (stock is int) return stock;
    if (stock is String) return int.tryParse(stock) ?? 0;
    return 0;
  }

  void _handleAddToCart(BuildContext context, Product product, bool isLoggedIn) {
    if (!isLoggedIn) {
      context.push('/login?redirect=/product/${widget.slug}');
      return;
    }

    if (_selectedSize == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor, selecciona una talla'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    ref.read(cartProvider.notifier).addItem(product, _selectedSize!, _quantity);
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Añadido al carrito: ${product.name} (Talla $_selectedSize)'),
            ),
          ],
        ),
        backgroundColor: Colors.green,
        action: SnackBarAction(
          label: 'VER CARRITO',
          textColor: Colors.white,
          onPressed: () => context.push('/cart'),
        ),
      ),
    );
  }
}

class _InfoBadge extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _InfoBadge({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1C1C),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: Theme.of(context).primaryColor, size: 24),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(
                  color: Colors.grey,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
