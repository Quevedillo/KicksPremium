import 'dart:convert';

class OrderItem {
  final String productId;
  final String productName;
  final String productBrand;
  final String productImage;
  final int price;
  final String size;
  final int quantity;

  OrderItem({
    required this.productId,
    required this.productName,
    required this.productBrand,
    required this.productImage,
    required this.price,
    required this.size,
    required this.quantity,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    return OrderItem(
      productId: json['product_id'] ?? product?['id'] ?? '',
      productName: product?['name'] ?? json['name'] ?? '',
      productBrand: product?['brand'] ?? json['brand'] ?? '',
      productImage: (product?['images'] as List?)?.first ?? json['image'] ?? '',
      price: json['price'] ?? product?['price'] ?? 0,
      size: json['size'] ?? '',
      quantity: json['quantity'] ?? json['qty'] ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': productId,
      'name': productName,
      'brand': productBrand,
      'image': productImage,
      'price': price,
      'size': size,
      'quantity': quantity,
    };
  }
}

class Order {
  final String id;
  final String? stripeSessionId;
  final String userId;
  final int totalPrice;
  final int? discountAmount;
  final String? discountCode;
  final String status;
  final String? returnStatus;
  final List<OrderItem> items;
  final String? shippingName;
  final Map<String, dynamic>? shippingAddress;
  final String? billingEmail;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Order({
    required this.id,
    this.stripeSessionId,
    required this.userId,
    required this.totalPrice,
    this.discountAmount,
    this.discountCode,
    required this.status,
    this.returnStatus,
    required this.items,
    this.shippingName,
    this.shippingAddress,
    this.billingEmail,
    required this.createdAt,
    this.updatedAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    List<OrderItem> items = [];
    final itemsData = json['items'];
    
    if (itemsData != null) {
      if (itemsData is String) {
        // Si viene como string JSON, parsearlo
        try {
          final jsonDecoded = jsonDecode(itemsData);
          if (jsonDecoded is List) {
            items = jsonDecoded.map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList();
          }
        } catch (e) {
          print('Error parsing items from string: $e');
        }
      } else if (itemsData is List) {
        // Si ya es una lista, mapearla directamente
        try {
          items = itemsData.map((e) {
            if (e is Map<String, dynamic>) {
              return OrderItem.fromJson(e);
            } else if (e is String) {
              return OrderItem.fromJson(jsonDecode(e) as Map<String, dynamic>);
            }
            return null;
          }).whereType<OrderItem>().toList();
        } catch (e) {
          print('Error parsing items from list: $e');
        }
      }
    }
    
    return Order(
      id: json['id'] as String? ?? '',
      stripeSessionId: json['stripe_session_id'] as String?,
      userId: json['user_id'] as String? ?? '',
      totalPrice: _parseInt(json['total_price']),
      discountAmount: _parseInt(json['discount_amount']),
      discountCode: json['discount_code'] as String?,
      status: json['status'] as String? ?? 'pending',
      returnStatus: json['return_status'] as String?,
      items: items,
      shippingName: json['shipping_name'] as String?,
      shippingAddress: json['shipping_address'] as Map<String, dynamic>?,
      billingEmail: json['billing_email'] as String?,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is String) return int.tryParse(value) ?? 0;
    if (value is double) return value.toInt();
    return 0;
  }

  String get displayId {
    if (stripeSessionId != null && stripeSessionId!.length >= 8) {
      return stripeSessionId!.substring(stripeSessionId!.length - 8).toUpperCase();
    }
    return id.substring(0, 8).toUpperCase();
  }

  String get statusLabel {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'pending':
        return 'Pendiente';
      case 'paid':
        return 'Pagado';
      case 'processing':
        return 'Procesando';
      case 'shipped':
        return 'Enviado';
      case 'delivered':
        return 'Entregado';
      case 'failed':
        return 'Fallido';
      case 'cancelled':
        return 'Cancelado';
      case 'refunded':
        return 'Reembolsado';
      default:
        return status;
    }
  }

  bool get canCancel => ['pending', 'paid', 'processing'].contains(status);
  bool get canReturn => status == 'delivered' && returnStatus == null;
}
