import 'product.dart';

class CartItem {
  final String productId;
  final Product product;
  final int quantity;
  final String size;

  CartItem({
    required this.productId,
    required this.product,
    required this.quantity,
    required this.size,
  });

  CartItem copyWith({
    String? productId,
    Product? product,
    int? quantity,
    String? size,
  }) {
    return CartItem(
      productId: productId ?? this.productId,
      product: product ?? this.product,
      quantity: quantity ?? this.quantity,
      size: size ?? this.size,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': productId,
      'product': product.toJson(),
      'quantity': quantity,
      'size': size,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      productId: json['product_id'] as String,
      product: Product.fromJson(json['product'] as Map<String, dynamic>),
      quantity: json['quantity'] as int,
      size: json['size'] as String,
    );
  }

  int get totalPrice => product.price * quantity;

  // Obtener stock disponible para esta talla
  int get availableStock {
    final stock = product.sizesAvailable[size];
    if (stock is int) return stock;
    if (stock is String) return int.tryParse(stock) ?? 0;
    return 0;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CartItem && 
           other.productId == productId && 
           other.size == size;
  }

  @override
  int get hashCode => productId.hashCode ^ size.hashCode;
}
