import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { items, discountCode } = body;

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

    console.log('Checkout: accessToken exists:', !!accessToken);
    console.log('Checkout: refreshToken exists:', !!refreshToken);

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Debe estar autenticado para hacer checkout. Por favor inicie sesión.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client and set session
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    let userId: string;
    let userEmail: string;

    // Try to get user from access token first
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error('Error getting user from token:', userError);
      
      // If we have a refresh token, try to refresh the session
      if (refreshToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });
        
        if (refreshError || !refreshData.session) {
          console.error('Error refreshing session:', refreshError);
          return new Response(
            JSON.stringify({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Update cookies with new tokens
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
        
        // Use the refreshed user
        userId = refreshData.session.user.id;
        userEmail = refreshData.session.user.email || '';
      } else {
        return new Response(
          JSON.stringify({ error: 'Sesión inválida. Por favor inicie sesión nuevamente.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      userId = user.id;
      userEmail = user.email || '';
    }

    console.log('Checkout: User ID:', userId);

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

    // Create Stripe Checkout Session with user metadata
    const checkoutSession = await stripe.checkout.sessions.create({
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
        user_id: userId,
        user_email: userEmail,
        cart_items: JSON.stringify(minimalCartItems),
        discount_code: discountCode || '',
      },
    });

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
