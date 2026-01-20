import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../logic/providers.dart';
import '../../../data/models/order.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLoggedIn = ref.watch(isLoggedInProvider);
    final ordersAsync = ref.watch(userOrdersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MIS PEDIDOS'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: !isLoggedIn
          ? _buildNotLoggedIn(context)
          : ordersAsync.when(
              data: (orders) => orders.isEmpty
                  ? _buildNoOrders(context)
                  : _buildOrdersList(context, ref, orders),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => _buildError(context, ref, err.toString()),
            ),
    );
  }

  Widget _buildNotLoggedIn(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 80,
              color: Colors.grey[600],
            ),
            const SizedBox(height: 24),
            Text(
              'Inicia sesión para ver tus pedidos',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: Colors.grey,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () => context.push('/login?redirect=/orders'),
              child: const Text('INICIAR SESIÓN'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoOrders(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 80,
              color: Colors.grey[600],
            ),
            const SizedBox(height: 24),
            Text(
              'No tienes pedidos aún',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '¡Es hora de conseguir tus kicks!',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () => context.go('/'),
              child: const Text('EXPLORAR PRODUCTOS'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            const Text(
              'Error cargando pedidos',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: const TextStyle(color: Colors.grey),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => ref.refresh(userOrdersProvider),
              child: const Text('REINTENTAR'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrdersList(BuildContext context, WidgetRef ref, List<Order> orders) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.refresh(userOrdersProvider);
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          return _OrderCard(order: orders[index]);
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Order order;

  const _OrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('d MMM yyyy, HH:mm', 'es_ES');
    final currencyFormat = NumberFormat.currency(locale: 'es_ES', symbol: '€');

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1C1C1C),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PEDIDO #${order.displayId}',
                      style: const TextStyle(
                        color: Colors.grey,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      dateFormat.format(order.createdAt),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _StatusBadge(status: order.status),
                    if (order.returnStatus != null) ...[
                      const SizedBox(height: 4),
                      _ReturnStatusBadge(status: order.returnStatus!),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      currencyFormat.format(order.totalPrice / 100),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    if (order.discountAmount != null && order.discountAmount! > 0)
                      Text(
                        'Descuento: -${currencyFormat.format(order.discountAmount! / 100)}',
                        style: const TextStyle(
                          color: Colors.green,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // Items
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PRODUCTOS (${order.items.length})',
                  style: const TextStyle(
                    color: Colors.grey,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                ...order.items.map((item) => _OrderItemRow(item: item)),
              ],
            ),
          ),

          // Shipping info
          if (order.shippingName != null || order.billingEmail != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF0A0A0A),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(12)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (order.shippingName != null) ...[
                    const Text(
                      'ENVÍO A:',
                      style: TextStyle(color: Colors.grey, fontSize: 10),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.shippingName!,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    if (order.shippingAddress != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        _formatAddress(order.shippingAddress!),
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ],
                  ],
                  if (order.billingEmail != null) ...[
                    if (order.shippingName != null) const SizedBox(height: 12),
                    const Text(
                      'EMAIL:',
                      style: TextStyle(color: Colors.grey, fontSize: 10),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.billingEmail!,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _formatAddress(Map<String, dynamic> address) {
    final parts = <String>[];
    if (address['line1'] != null) parts.add(address['line1']);
    if (address['line2'] != null) parts.add(address['line2']);
    if (address['city'] != null) parts.add(address['city']);
    if (address['state'] != null) parts.add(address['state']);
    if (address['postal_code'] != null) parts.add(address['postal_code']);
    if (address['country'] != null) parts.add(address['country']);
    return parts.join(', ');
  }
}

class _OrderItemRow extends StatelessWidget {
  final OrderItem item;

  const _OrderItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'es_ES', symbol: '€');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0A0A),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          // Image
          if (item.productImage.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                width: 50,
                height: 50,
                child: Image.network(
                  item.productImage,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: Colors.grey[800],
                    child: const Icon(Icons.image, size: 20),
                  ),
                ),
              ),
            ),
          
          const SizedBox(width: 12),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productBrand.toUpperCase(),
                  style: TextStyle(
                    color: Theme.of(context).primaryColor,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  item.productName,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'Talla: ${item.size} | Cantidad: ${item.quantity}',
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                ),
              ],
            ),
          ),

          // Price
          Text(
            currencyFormat.format((item.price * item.quantity) / 100),
            style: TextStyle(
              color: Colors.orange[300],
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final config = _getStatusConfig(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: config.color.withOpacity(0.2),
        border: Border.all(color: config.color),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        config.label,
        style: TextStyle(
          color: config.color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status) {
      case 'completed':
        return _StatusConfig(Colors.green, 'Completado');
      case 'pending':
        return _StatusConfig(Colors.yellow, 'Pendiente');
      case 'paid':
        return _StatusConfig(Colors.blue, 'Pagado');
      case 'processing':
        return _StatusConfig(Colors.cyan, 'Procesando');
      case 'shipped':
        return _StatusConfig(Colors.indigo, 'Enviado');
      case 'delivered':
        return _StatusConfig(Colors.teal, 'Entregado');
      case 'failed':
        return _StatusConfig(Colors.red, 'Fallido');
      case 'cancelled':
        return _StatusConfig(Colors.grey, 'Cancelado');
      case 'refunded':
        return _StatusConfig(Colors.purple, 'Reembolsado');
      default:
        return _StatusConfig(Colors.grey, status);
    }
  }
}

class _ReturnStatusBadge extends StatelessWidget {
  final String status;

  const _ReturnStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    String label;
    switch (status) {
      case 'requested':
        label = 'Devolución Solicitada';
        break;
      case 'approved':
        label = 'Devolución Aprobada';
        break;
      case 'received':
        label = 'Devolución Recibida';
        break;
      case 'refunded':
        label = 'Reembolsado';
        break;
      default:
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.amber.withOpacity(0.2),
        border: Border.all(color: Colors.amber),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.amber,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _StatusConfig {
  final Color color;
  final String label;

  _StatusConfig(this.color, this.label);
}
