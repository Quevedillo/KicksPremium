import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../data/models/product.dart';

class ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback? onTap;

  const ProductCard({super.key, required this.product, this.onTap});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'es_ES', symbol: '€', decimalDigits: 0);
    final price = currencyFormat.format(product.price / 100);

    // Contar tallas disponibles
    final availableSizesCount = product.sizesAvailable.entries
        .where((e) {
          final qty = e.value;
          if (qty is int) return qty > 0;
          if (qty is String) return (int.tryParse(qty) ?? 0) > 0;
          return false;
        })
        .length;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1C1C1C),
          borderRadius: BorderRadius.circular(12),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image with badges
            Expanded(
              child: Stack(
                children: [
                  // Product image
                  SizedBox(
                    width: double.infinity,
                    child: product.images.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: product.images.first,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                              color: Colors.grey[900],
                              child: const Center(
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                            errorWidget: (_, __, ___) => Container(
                              color: Colors.grey[900],
                              child: const Icon(Icons.error, color: Colors.grey),
                            ),
                          )
                        : Container(
                            color: Colors.grey[900],
                            child: const Icon(Icons.image_not_supported, color: Colors.grey),
                          ),
                  ),

                  // Limited edition badge
                  if (product.isLimitedEdition)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Theme.of(context).primaryColor,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'LIMITED',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),

                  // Low stock badge
                  if (product.stock <= 5 && product.stock > 0)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.orange,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'ÚLTIMAS ${product.stock}',
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Product info
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Brand
                  if (product.brand != null)
                    Text(
                      product.brand!.toUpperCase(),
                      style: TextStyle(
                        color: Theme.of(context).primaryColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  
                  const SizedBox(height: 2),
                  
                  // Name
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      height: 1.2,
                    ),
                  ),
                  
                  const SizedBox(height: 6),
                  
                  // Price row
                  Row(
                    children: [
                      Text(
                        price,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      if (product.comparePrice != null && product.comparePrice! > product.price) ...[
                        const SizedBox(width: 6),
                        Text(
                          currencyFormat.format(product.comparePrice! / 100),
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 12,
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                    ],
                  ),

                  // Available sizes indicator
                  if (availableSizesCount > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      '$availableSizesCount tallas',
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 10,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
