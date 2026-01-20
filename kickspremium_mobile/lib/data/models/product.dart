
class Product {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final Map<String, dynamic>? detailedDescription;
  final int price;
  final int? comparePrice;
  final int stock;
  final String? categoryId;
  final String? brand;
  final String? model;
  final String? colorway;
  final String? sku;
  final bool isLimitedEdition;
  final bool isFeatured;
  final bool isActive;
  final Map<String, dynamic> sizesAvailable;
  final List<String> images;
  final List<String> tags;
  final DateTime createdAt;

  Product({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.detailedDescription,
    required this.price,
    this.comparePrice,
    required this.stock,
    this.categoryId,
    this.brand,
    this.model,
    this.colorway,
    this.sku,
    required this.isLimitedEdition,
    required this.isFeatured,
    required this.isActive,
    required this.sizesAvailable,
    required this.images,
    required this.tags,
    required this.createdAt,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      detailedDescription: json['detailed_description'] as Map<String, dynamic>?,
      price: json['price'] as int,
      comparePrice: json['compare_price'] as int?,
      stock: json['stock'] as int? ?? 0,
      categoryId: json['category_id'] as String?,
      brand: json['brand'] as String?,
      model: json['model'] as String?,
      colorway: json['colorway'] as String?,
      sku: json['sku'] as String?,
      isLimitedEdition: json['is_limited_edition'] as bool? ?? false,
      isFeatured: json['is_featured'] as bool? ?? false,
      isActive: json['is_active'] as bool? ?? true,
      sizesAvailable: json['sizes_available'] as Map<String, dynamic>? ?? {},
      images: List<String>.from(json['images'] ?? []),
      tags: List<String>.from(json['tags'] ?? []),
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'description': description,
      'detailed_description': detailedDescription,
      'price': price,
      'compare_price': comparePrice,
      'stock': stock,
      'category_id': categoryId,
      'brand': brand,
      'model': model,
      'colorway': colorway,
      'sku': sku,
      'is_limited_edition': isLimitedEdition,
      'is_featured': isFeatured,
      'is_active': isActive,
      'sizes_available': sizesAvailable,
      'images': images,
      'tags': tags,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
