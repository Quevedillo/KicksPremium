import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay productos en el carrito' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
    }) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${item.product.brand ? item.product.brand + ' - ' : ''}${item.product.name}`,
          description: `Talla: ${item.size}`,
          images: item.product.images.slice(0, 1), // Stripe allows max 8 images
        },
        unit_amount: item.product.price, // Price is already in cents
      },
      quantity: item.quantity,
    }));

    // Get the origin from the request
    const origin = request.headers.get('origin') || 'http://localhost:4322';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
      },
    });

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
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
