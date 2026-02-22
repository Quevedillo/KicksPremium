import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';
import { sendNewProductToAllSubscribers, sendNewOfferToAllSubscribers } from '@lib/email';

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
    
    // Validar campos requeridos
    const name = body.name?.toString().trim();
    const description = body.description?.toString().trim();
    const categoryId = body.category_id?.toString().trim();
    const basePriceEur = parseFloat(body.price ?? 0);
    const cost_price = Math.round((parseFloat(body.cost_price ?? 0) * 100)); // Convertir EUR a centimos
    let stock = parseInt(body.stock ?? 0);
    const images = Array.isArray(body.images) ? body.images : [];
    const brand = body.brand?.toString().trim() || null;
    const color = body.color?.toString().trim() || null;
    
    // Campos de colección
    const is_limited_edition = body.is_limited_edition === true || body.is_limited_edition === 'true';
    const release_type = ['standard', 'restock', 'limited'].includes(body.release_type) ? body.release_type : 'standard';
    
    // Campos de descuento
    const discount_type = ['percentage', 'fixed'].includes(body.discount_type) ? body.discount_type : null;
    const discount_value = discount_type ? parseFloat(body.discount_value ?? 0) : null;
    
    // Calcular precio final con descuento
    let finalPriceCents = Math.round(basePriceEur * 100);
    let original_price: number | null = null;
    
    if (discount_type && discount_value && discount_value > 0) {
      original_price = finalPriceCents; // Guardar precio original
      if (discount_type === 'percentage') {
        finalPriceCents = Math.round(finalPriceCents * (1 - discount_value / 100));
      } else if (discount_type === 'fixed') {
        finalPriceCents = Math.max(0, finalPriceCents - Math.round(discount_value * 100));
      }
    }
    
    // Procesar sizes_available
    let sizes_available: Record<string, number> = {};
    if (body.sizes_available && typeof body.sizes_available === 'object') {
      // Convertir valores a números y filtrar valores válidos (> 0)
      Object.entries(body.sizes_available).forEach(([size, qty]: [string, any]) => {
        const quantity = parseInt(qty) || 0;
        if (quantity > 0) {
          sizes_available[size] = quantity;
        }
      });
    }
    
    // Si se proporcionó sizes_available, calcular stock desde ahí
    // Si no, usar el stock proporcionado
    if (Object.keys(sizes_available).length > 0) {
      stock = Object.values(sizes_available).reduce((sum: number, qty: number) => sum + qty, 0);
    }

    if (!name || !description || !categoryId || isNaN(finalPriceCents) || finalPriceCents < 0 || isNaN(cost_price) || cost_price < 0 || isNaN(stock) || stock < 0) {
      console.error('Validación fallida:', { name, description, categoryId, price: finalPriceCents, cost_price, stock });
      return new Response(JSON.stringify({ 
        error: 'Faltan campos requeridos o son inválidos',
        details: { name: !!name, description: !!description, categoryId: !!categoryId, price: finalPriceCents, cost_price, stock }
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

    // Generar SKU automático si no se proporciona
    let sku = body.sku?.toString().trim() || null;
    if (!sku) {
      // Generar SKU: BRAND-SLUG-TIMESTAMP
      const brandPrefix = brand ? brand.substring(0, 3).toUpperCase() : 'PRD';
      const slugPrefix = finalSlug.substring(0, 8).toUpperCase().replace(/-/g, '');
      const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
      sku = `${brandPrefix}-${slugPrefix}-${timestamp}`;
    } else {
      // Verificar SKU único
      const { data: existingSkuProduct } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .single();
      
      if (existingSkuProduct) {
        return new Response(JSON.stringify({ 
          error: 'El SKU ya existe',
          details: `Ya existe un producto con el SKU: ${sku}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Crear producto con campos básicos usando service client para bypass RLS
    const serviceClient = getSupabaseServiceClient();
    const { data: product, error } = await serviceClient
      .from('products')
      .insert({
        name,
        slug: finalSlug,
        description,
        category_id: categoryId,
        price: finalPriceCents,
        original_price: original_price,
        cost_price,
        stock,
        sizes_available: Object.keys(sizes_available).length > 0 ? sizes_available : null,
        images: images && images.length > 0 ? images : [],
        brand,
        sku,
        color,
        is_limited_edition,
        release_type,
        discount_type,
        discount_value,
      })
      .select(`
        *,
        categories(name)
      `)
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return new Response(JSON.stringify({ error: 'Error al crear el producto', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Enviar notificación a los suscriptores del newsletter
    let newsletterResult = null;
    try {
      // Obtener todos los suscriptores verificados
      const { data: subscribers, error: subscribersError } = await supabase
        .from('newsletter_subscribers')
        .select('email')
        .eq('verified', true);

      if (subscribersError) {
        console.error('Error fetching newsletter subscribers:', subscribersError);
      } else if (subscribers && subscribers.length > 0) {
        // Preparar datos del producto para el email
        const productData = {
          name: product.name,
          slug: product.slug,
          description: product.description || '',
          price: product.price,
          originalPrice: product.original_price || null,
          images: product.images || [],
          brand: product.brand,
          category: product.categories?.name || null,
          isLimitedEdition: product.is_limited_edition,
          discountType: product.discount_type || null,
          discountValue: product.discount_value || null,
        };

        // Si tiene descuento, enviar email de oferta; si no, email de nuevo producto
        const hasDiscount = product.discount_type && product.discount_value && product.discount_value > 0;
        
        if (hasDiscount) {
          sendNewOfferToAllSubscribers(subscribers, productData)
            .then((result) => {
              console.log(`Newsletter OFERTA enviado para ${product.slug}:`, result);
            })
            .catch((emailError) => {
              console.error(`Error enviando newsletter oferta para ${product.slug}:`, emailError);
            });
        } else {
          sendNewProductToAllSubscribers(subscribers, productData)
            .then((result) => {
              console.log(`Newsletter enviado para producto ${product.slug}:`, result);
            })
            .catch((emailError) => {
              console.error(`Error enviando newsletter para ${product.slug}:`, emailError);
            });
        }

        newsletterResult = {
          scheduledFor: subscribers.length,
          message: hasDiscount 
            ? 'Notificación de OFERTA programada para enviar a los suscriptores'
            : 'Notificación programada para enviar a los suscriptores',
        };
      } else {
        newsletterResult = {
          scheduledFor: 0,
          message: 'No hay suscriptores verificados',
        };
      }
    } catch (newsletterError) {
      console.error('Error processing newsletter:', newsletterError);
      newsletterResult = {
        error: 'Error al procesar el newsletter',
      };
    }

    return new Response(JSON.stringify({ 
      success: true, 
      product,
      newsletter: newsletterResult,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en POST /api/admin/products:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
