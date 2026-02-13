import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { createClient } from '@supabase/supabase-js';

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

    if (accessToken) {
      // Authenticated user flow
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
            // Token invalid - fall through to guest checkout if email provided
            if (!guestEmail) {
              return new Response(
                JSON.stringify({ error: 'Sesión expirada. Por favor inicie sesión o introduzca su email.' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
              );
            }
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

    // Guest checkout: require email
    if (!userId) {
      if (!guestEmail || !guestEmail.includes('@')) {
        return new Response(
          JSON.stringify({ error: 'Debe introducir un email válido para continuar con la compra.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      userEmail = guestEmail;
    }

    console.log('Checkout:', userId ? `User ${userId}` : `Guest ${userEmail}`);

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

    // Create minimal cart items for metadata (Stripe has 500 char limit per value)
    const minimalCartItems = items.map((item: {
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
      name: item.product.name,
      brand: item.product.brand || '',
      price: item.product.price,
      qty: item.quantity,
      size: item.size,
      img: item.product.images?.[0] || '',
    }));

    // Handle discount code - create a Stripe coupon if discount is provided
    let stripeCouponId: string | undefined = undefined;
    const discountInfo = body.discountInfo; // { discount_type, discount_value }
    
    if (discountCode && discountInfo) {
      try {
        // Calculate discount based on type
        const subtotal = items.reduce((sum: number, item: any) => 
          sum + (item.product.price < 100 ? item.product.price * 100 : item.product.price) * item.quantity, 0
        );
        
        let couponParams: any = {
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
    const sessionOptions: any = {
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
        cart_items: JSON.stringify(minimalCartItems),
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
