import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../data/repositories/product_repository.dart';
import '../../logic/providers.dart';

// Create a provider family for fetching single product by slug
final productBySlugProvider = FutureProvider.family<Product?, String>((ref, slug) async {
  return ref.watch(productRepositoryProvider).getProductBySlug(slug);
});

class ProductDetailScreen extends ConsumerWidget {
  final String slug;

  const ProductDetailScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productAsync = ref.watch(productBySlugProvider(slug));

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.share, color: Colors.white),
            onPressed: () {},
          ),
        ],
      ),
      body: productAsync.when(
        data: (product) {
          if (product == null) {
            return const Center(child: Text("Product not found"));
          }

          final currencyFormat = NumberFormat.currency(locale: 'es_ES', symbol: '€');
          final price = currencyFormat.format(product.price / 100);

          return Column(
            children: [
              // Image Carousel (simplified to first image for now)
              Expanded(
                flex: 5,
                child: Stack(
                  children: [
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.grey[900],
                      ),
                      child: CachedNetworkImage(
                        imageUrl: product.images.first,
                        fit: BoxFit.cover,
                      ),
                    ),
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
                            stops: [0.0, 1.0],
                          ),
                        ),
                        child: SizedBox(height: 80),
                      ),
                    ),
                  ],
                ),
              ),

              // Details
              Expanded(
                flex: 4,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: const BoxDecoration(
                    color: Color(0xFF0A0A0A),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                       Row(
                         mainAxisAlignment: MainAxisAlignment.spaceBetween,
                         children: [
                           Expanded(
                             child: Text(
                               product.name,
                               style: Theme.of(context).textTheme.headlineLarge,
                               maxLines: 2,
                             ),
                           ),
                           const SizedBox(width: 16),
                           Text(
                             price,
                             style: Theme.of(context).textTheme.displayMedium?.copyWith(
                               color: Theme.of(context).primaryColor,
                             ),
                           ),
                         ],
                       ),
                       const SizedBox(height: 8),
                       if (product.brand != null)
                         Text(
                           product.brand!.toUpperCase(),
                           style: const TextStyle(color: Colors.grey, letterSpacing: 1.5),
                         ),
                       
                       const SizedBox(height: 24),
                       
                       // Description
                       Text(
                         "DESCRIPTION",
                         style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey),
                       ),
                       const SizedBox(height: 8),
                       Text(
                         product.description ?? "No description",
                         style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                           color: Colors.white70, 
                           height: 1.5
                         ),
                         maxLines: 3,
                         overflow: TextOverflow.ellipsis,
                       ),
                       
                       const Spacer(),
                       
                       // Action Button
                       SizedBox(
                         width: double.infinity,
                         height: 56,
                         child: ElevatedButton(
                           onPressed: () {
                             ScaffoldMessenger.of(context).showSnackBar(
                               const SnackBar(content: Text("Added to cart (Mock)")),
                             );
                           },
                           child: const Text("ADD TO CART"),
                         ),
                       ),
                    ],
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
}
