import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/order.dart';

class OrderRepository {
  final SupabaseClient _client;

  OrderRepository(this._client);

  Future<List<Order>> getUserOrders() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];

    final data = await _client
        .from('orders')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);

    return (data as List).map((e) => Order.fromJson(e)).toList();
  }

  Future<Order?> getOrderById(String orderId) async {
    final data = await _client
        .from('orders')
        .select()
        .eq('id', orderId)
        .maybeSingle();

    if (data == null) return null;
    return Order.fromJson(data);
  }

  Future<bool> cancelOrder(String orderId) async {
    try {
      await _client
          .from('orders')
          .update({'status': 'cancelled'})
          .eq('id', orderId);
      return true;
    } catch (e) {
      print('Error cancelling order: $e');
      return false;
    }
  }

  Future<bool> requestReturn(String orderId, String reason) async {
    try {
      await _client
          .from('orders')
          .update({
            'return_status': 'requested',
            'return_reason': reason,
          })
          .eq('id', orderId);
      return true;
    } catch (e) {
      print('Error requesting return: $e');
      return false;
    }
  }
}
