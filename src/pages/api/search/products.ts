import type { APIRoute } from 'astro';
import { getSupabaseServiceClient } from '@lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim() || '';
  const limit = parseInt(url.searchParams.get('limit') || '8');

  // Si no hay query, devolver vacío
  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ products: [], query }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const supabase = getSupabaseServiceClient();
    
    // Búsqueda ILIKE (insensible a mayúsculas/minúsculas)
    // Busca en nombre, marca, modelo, colorway y descripción
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        price,
        brand,
        model,
        colorway,
        images,
        stock,
        is_limited_edition
      `)
      .eq('is_active', true)
      .gt('stock', 0)
      .or(`name.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%,colorway.ilike.%${query}%,description.ilike.%${query}%`)
      .order('is_limited_edition', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Search error:', error);
      return new Response(JSON.stringify({ error: 'Error en la búsqueda', products: [] }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Formatear resultados
    const formattedProducts = (products || []).map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      priceFormatted: `€${(product.price / 100).toFixed(0)}`,
      brand: product.brand,
      model: product.model,
      colorway: product.colorway,
      image: product.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop',
      isLimited: product.is_limited_edition,
      stock: product.stock,
    }));

    return new Response(JSON.stringify({ 
      products: formattedProducts, 
      query,
      total: formattedProducts.length 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // Cache 1 minuto
      },
    });

  } catch (err) {
    console.error('Search exception:', err);
    return new Response(JSON.stringify({ error: 'Error interno', products: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
