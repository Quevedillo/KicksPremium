import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@lib/supabase';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { items, discountCode, guestEmail } = body;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay productos en el carrito' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get tokens from cookies or Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearer = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.split(' ')[1]
      : undefined;

    const accessToken = bearer || cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    let userId: string | null = null;
    let userEmail: string = '';

    // IMPORTANT: If guestEmail is explicitly provided, this is a guest checkout request.
    // Skip all auth detection - the client explicitly chose to checkout as guest.
    if (guestEmail && guestEmail.includes('@')) {
      // Check if this email belongs to a registered user
      const serviceClient = getSupabaseServiceClient();
      const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === guestEmail.toLowerCase()
      );
      
      if (existingUser) {
        // Email is registered - require password authentication
        return new Response(
          JSON.stringify({ 
            error: 'email_registered',
            message: 'Este email ya tiene una cuenta registrada. Introduce tu contraseña para continuar.'
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      userId = null;
      userEmail = guestEmail;
      console.log('Guest checkout requested with email:', guestEmail);
    } else if (accessToken) {
      // Authenticated user flow (no guestEmail provided)
      const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

      if (userError || !user) {
        // Try refresh token
        if (refreshToken) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
          });
          
          if (refreshError || !refreshData.session) {
            return new Response(
              JSON.stringify({ error: 'Sesión expirada. Por favor inicie sesión o introduzca su email.' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          } else {
            cookies.set('sb-access-token', refreshData.session.access_token, {
              path: '/',
              maxAge: 3600,
              sameSite: 'lax',
            });
            cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
              path: '/',
              maxAge: 604800,
              sameSite: 'lax',
            });
            userId = refreshData.session.user.id;
            userEmail = refreshData.session.user.email || '';
          }
        }
      } else {
        userId = user.id;
        userEmail = user.email || '';
      }
    }

    // No auth and no guestEmail: require email
    if (!userId && !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Debe introducir un email válido para continuar con la compra.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checkout:', userId ? `User ${userId}` : `Guest ${userEmail}`);

    // ===== VALIDACIÓN DE STOCK SERVER-SIDE =====
    const serviceClient = getSupabaseServiceClient();
    const stockErrors: string[] = [];

    for (const item of items) {
      const productId = item.product_id || item.product?.id;
      const size = item.size;
      const quantity = item.quantity || 1;

      if (!productId || !size) continue;

      const { data: product, error: fetchErr } = await serviceClient
        .from('products')
        .select('name, sizes_available')
        .eq('id', productId)
        .single();

      if (fetchErr || !product) {
        stockErrors.push(`Producto no encontrado: ${item.product?.name || productId}`);
        continue;
      }

      const sizesAvailable = product.sizes_available as Record<string, number> | null;
      const available = sizesAvailable ? (parseInt(String(sizesAvailable[size])) || 0) : 0;

      if (available < quantity) {
        stockErrors.push(
          `"${product.name}" talla ${size}: solo quedan ${available} unidades (solicitadas: ${quantity})`
        );
      }
    }

    if (stockErrors.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Stock insuficiente',
          details: stockErrors,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform cart items to Stripe line items
    const lineItems = items.map((item: {
      product: {
        name: string;
        images: string[];
        price: number;
        brand?: string;
      };
      quantity: number;
      size: string;
    }) => {
      // Ensure price is in cents for Stripe
      // If price < 100, assume it's in euros and multiply by 100
      // If price >= 100, assume it's already in cents
      const priceInCents = item.product.price < 100 
        ? Math.round(item.product.price * 100)
        : item.product.price;
      
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${item.product.brand ? item.product.brand + ' - ' : ''}${item.product.name}`,
            description: `Talla: ${item.size}`,
            images: item.product.images.slice(0, 1), // Stripe allows max 8 images
          },
          unit_amount: priceInCents,
        },
        quantity: item.quantity,
      };
    });

    // Get the origin from the request
    const origin = request.headers.get('origin') || 'http://localhost:4322';

    // Create compact cart items for metadata (Stripe has 500 char limit per value)
    // Only store essential fields; img/brand are fetched from DB later
    const compactCartItems = items.map((item: {
      product_id: string;
      product: {
        id: string;
        name: string;
        price: number;
        brand?: string;
        images?: string[];
      };
      quantity: number;
      size: string;
    }) => ({
      id: item.product_id || item.product.id,
      n: item.product.name.substring(0, 40),
      p: item.product.price,
      q: item.quantity,
      s: item.size,
    }));

    // Build cart_items metadata with chunking if needed
    const cartItemsJson = JSON.stringify(compactCartItems);
    const cartMetadata: Record<string, string> = {};
    if (cartItemsJson.length <= 500) {
      cartMetadata.cart_items = cartItemsJson;
    } else {
      // Split into 490-char chunks across multiple metadata keys
      const chunkSize = 490;
      const chunks: string[] = [];
      for (let i = 0; i < cartItemsJson.length; i += chunkSize) {
        chunks.push(cartItemsJson.substring(i, i + chunkSize));
      }
      cartMetadata.cart_items_chunks = String(chunks.length);
      chunks.forEach((chunk, i) => {
        cartMetadata[`cart_items_${i}`] = chunk;
      });
    }

    // Handle discount code - create a Stripe coupon if discount is provided
    let stripeCouponId: string | undefined = undefined;
    const discountInfo = body.discountInfo; // { discount_type, discount_value }
    
    if (discountCode && discountInfo) {
      try {
        // Calculate discount based on type
        const subtotal = items.reduce((sum: number, item: { product: { price: number }; quantity: number }) => 
          sum + (item.product.price < 100 ? item.product.price * 100 : item.product.price) * item.quantity, 0
        );
        
        let couponParams: Stripe.CouponCreateParams = {
          duration: 'once',
          name: `Descuento ${discountCode}`,
        };
        
        if (discountInfo.discount_type === 'percentage') {
          couponParams.percent_off = discountInfo.discount_value;
        } else {
          // Fixed amount in cents
          couponParams.amount_off = discountInfo.discount_value < 100 
            ? Math.round(discountInfo.discount_value * 100) 
            : discountInfo.discount_value;
          couponParams.currency = 'eur';
        }
        
        const coupon = await stripe.coupons.create(couponParams);
        stripeCouponId = coupon.id;
        console.log(`✅ Created Stripe coupon: ${coupon.id} for code ${discountCode}`);
      } catch (couponError) {
        console.error('⚠️ Error creating Stripe coupon:', couponError);
        // Continue without discount if coupon creation fails
      }
    }

    // Build checkout session options
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      shipping_address_collection: {
        allowed_countries: ['US', 'MX', 'ES', 'AR', 'CO', 'CL', 'PE'],
      },
      billing_address_collection: 'required',
      locale: 'es',
      metadata: {
        items_count: items.length.toString(),
        user_id: userId || '',
        user_email: userEmail,
        guest_email: !userId ? userEmail : '',
        ...cartMetadata,
        discount_code: discountCode || '',
        discount_amount: discountInfo ? String(discountInfo.discount_value) : '0',
      },
    };

    // Add discount if coupon was created
    if (stripeCouponId) {
      sessionOptions.discounts = [{ coupon: stripeCouponId }];
    }

    // Create Stripe Checkout Session with user metadata
    const checkoutSession = await stripe.checkout.sessions.create(sessionOptions);

    return new Response(
      JSON.stringify({ 
        sessionId: checkoutSession.id,
        url: checkoutSession.url 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
