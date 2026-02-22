import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';
import { sendNewOfferToAllSubscribers } from '@lib/email';

// GET single product
export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ product: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// PUT - Update product
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autenticación usando el cliente de servicio
    const serviceClient = getSupabaseServiceClient();
    
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar el token y obtener el usuario
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si es admin consultando user_profiles
    const { data: adminProfile } = await serviceClient
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

    const body = await request.json();
    const {
      name,
      slug,
      description,
      category_id,
      brand,
      color,
      images,
      cost_price,
    } = body;
    let { sku, stock, sizes_available } = body;

    // Campos de colección
    const is_limited_edition = body.is_limited_edition === true || body.is_limited_edition === 'true';
    const release_type = ['standard', 'restock', 'limited'].includes(body.release_type) ? body.release_type : 'standard';
    
    // Campos de descuento
    const discount_type = ['percentage', 'fixed'].includes(body.discount_type) ? body.discount_type : null;
    const discount_value = discount_type ? parseFloat(body.discount_value ?? 0) : null;

    if (!name || !slug || body.price === undefined || isNaN(parseFloat(body.price)) || parseFloat(body.price) < 0) {
      return new Response(
        JSON.stringify({ error: 'Campos requeridos inválidos: name, slug, price (>=0)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convertir EUR a centimos
    const basePriceEur = parseFloat(body.price);
    let priceInCents = Math.round(basePriceEur * 100);
    let original_price: number | null = null;
    const costPriceInCents = cost_price ? Math.round(parseFloat(cost_price) * 100) : null;

    // Calcular precio final con descuento
    if (discount_type && discount_value && discount_value > 0) {
      original_price = priceInCents; // Guardar precio original
      if (discount_type === 'percentage') {
        priceInCents = Math.round(priceInCents * (1 - discount_value / 100));
      } else if (discount_type === 'fixed') {
        priceInCents = Math.max(0, priceInCents - Math.round(discount_value * 100));
      }
    }

    // Procesar sizes_available y calcular stock
    let processedSizes: Record<string, number> = {};
    if (sizes_available && typeof sizes_available === 'object') {
      Object.entries(sizes_available).forEach(([size, qty]: [string, unknown]) => {
        const quantity = parseInt(String(qty)) || 0;
        if (quantity > 0) {
          processedSizes[size] = quantity;
        }
      });
    }
    
    // Calcular stock desde sizes_available
    if (Object.keys(processedSizes).length > 0) {
      stock = Object.values(processedSizes).reduce((sum: number, qty: number) => sum + qty, 0);
    } else {
      stock = parseInt(stock) || 0;
    }

    // Generar SKU automático si no se proporciona
    if (!sku || !sku.trim()) {
      const brandPrefix = brand ? brand.substring(0, 3).toUpperCase() : 'PRD';
      const slugPrefix = slug.substring(0, 8).toUpperCase().replace(/-/g, '');
      const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
      sku = `${brandPrefix}-${slugPrefix}-${timestamp}`;
    } else {
      // Verificar SKU único (excluyendo el producto actual) - sin .single() para evitar error
      const { data: existingSkuProducts } = await serviceClient
        .from('products')
        .select('id')
        .eq('sku', sku)
        .neq('id', id);
      
      if (existingSkuProducts && existingSkuProducts.length > 0) {
        return new Response(
          JSON.stringify({ error: 'El SKU ya existe', details: `Ya existe otro producto con el SKU: ${sku}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Usar service client para bypass RLS
    const { data, error } = await serviceClient
      .from('products')
      .update({
        name,
        slug,
        description,
        price: priceInCents,
        original_price: original_price,
        cost_price: costPriceInCents,
        stock: stock,
        sizes_available: Object.keys(processedSizes).length > 0 ? processedSizes : {},
        category_id,
        brand: brand || null,
        sku: sku || null,
        color: color || null,
        images: Array.isArray(images) ? images : [],
        is_limited_edition,
        release_type,
        discount_type,
        discount_value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, categories(name)');

    if (error) {
      console.error('[API] Error updating product:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Error al actualizar producto' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // data es un array sin .single()
    const updatedProduct = data && data.length > 0 ? data[0] : null;
    
    if (!updatedProduct) {
      return new Response(
        JSON.stringify({ error: 'Producto no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si se añadió o modificó un descuento, enviar newsletter de oferta
    let newsletterResult = null;
    if (discount_type && discount_value && discount_value > 0) {
      try {
        const { data: subscribers, error: subscribersError } = await supabase
          .from('newsletter_subscribers')
          .select('email')
          .eq('verified', true);

        if (!subscribersError && subscribers && subscribers.length > 0) {
          const productData = {
            name: updatedProduct.name,
            slug: updatedProduct.slug,
            description: updatedProduct.description || '',
            price: updatedProduct.price,
            originalPrice: updatedProduct.original_price || null,
            images: updatedProduct.images || [],
            brand: updatedProduct.brand,
            category: updatedProduct.categories?.name || null,
            isLimitedEdition: updatedProduct.is_limited_edition,
            discountType: discount_type,
            discountValue: discount_value,
          };

          sendNewOfferToAllSubscribers(subscribers, productData)
            .then((result) => {
              console.log(`Newsletter OFERTA enviado para ${updatedProduct.slug}:`, result);
            })
            .catch((emailError) => {
              console.error(`Error enviando newsletter oferta para ${updatedProduct.slug}:`, emailError);
            });

          newsletterResult = {
            scheduledFor: subscribers.length,
            message: 'Notificación de oferta programada',
          };
        }
      } catch (newsletterError) {
        console.error('Error processing offer newsletter:', newsletterError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, product: updatedProduct, newsletter: newsletterResult }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[API] Catch error in PUT:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE - Delete product
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
