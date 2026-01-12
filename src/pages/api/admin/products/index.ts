import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

// GET - List all products
export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si es admin
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener productos con filtros
    const categoryId = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return new Response(JSON.stringify({ error: 'Error al obtener productos' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ products }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en GET /api/admin/products:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Create new product
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si es admin
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parsear body
    const body = await request.json();
    
    // Validar campos requeridos - convertir a valores estrictos
    const name = body.name?.toString().trim();
    const description = body.description?.toString().trim();
    const categoryId = body.category_id?.toString().trim();
    const price = parseFloat(body.price || 0);
    const stock = parseInt(body.stock || 0);

    if (!name || !description || !categoryId || price <= 0 || stock < 0) {
      console.error('Validación fallida:', { name, description, categoryId, price, stock });
      return new Response(JSON.stringify({ 
        error: 'Faltan campos requeridos o son inválidos: name, description, category_id, price (>0), stock (>=0)',
        details: { name: !!name, description: !!description, categoryId: !!categoryId, price, stock }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generar slug si no se proporciona
    const slug = body.slug?.toString().trim() || name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Verificar slug único
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    let finalSlug = slug;
    if (existingProduct) {
      finalSlug = `${slug}-${Date.now()}`;
    }

    // Crear producto
    const productData = {
      name,
      slug: finalSlug,
      description,
      category_id: categoryId,
      price,
      compare_price: body.compare_price ? parseFloat(body.compare_price) : null,
      stock,
      images: body.images || [],
      sku: body.sku?.toString().trim() || null,
      material: body.material?.toString().trim() || null,
      brand: body.brand?.toString().trim() || null,
      color: body.color?.toString().trim() || null,
      is_featured: body.is_featured || false,
      is_active: body.is_active !== false, // default true
    };

    const { data: product, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return new Response(JSON.stringify({ error: 'Error al crear el producto', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, product }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en POST /api/admin/products:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
