import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/product.dart';
import '../models/category.dart';

class ProductRepository {
  final SupabaseClient _client;

  ProductRepository(this._client);

  Future<List<Product>> getProducts({String? categorySlug}) async {
    var query = _client.from('products').select().eq('is_active', true);

    if (categorySlug != null) {
      // First get category ID
      final categoryData = await _client
          .from('categories')
          .select('id')
          .eq('slug', categorySlug)
          .single();
      
      query = query.eq('category_id', categoryData['id']);
    }

    final data = await query.order('created_at', ascending: false);
    return (data as List).map((e) => Product.fromJson(e)).toList();
  }

  Future<Product?> getProductBySlug(String slug) async {
    final data = await _client
        .from('products')
        .select()
        .eq('slug', slug)
        .maybeSingle();
    
    if (data == null) return null;
    return Product.fromJson(data);
  }

  Future<List<Category>> getCategories() async {
    final data = await _client
        .from('categories')
        .select()
        .order('display_order');
    return (data as List).map((e) => Category.fromJson(e)).toList();
  }
}
