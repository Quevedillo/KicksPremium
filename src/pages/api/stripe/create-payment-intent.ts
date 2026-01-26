import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');

interface PaymentIntentRequest {
  amount: number;
  currency: string;
  orderId: string;
  metadata?: Record<string, string>;
}

export const POST: APIRoute = async (context) => {
  try {
    const body: PaymentIntentRequest = await context.request.json();

    const { amount, currency, orderId, metadata = {} } = body;

    // Validaciones
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Monto inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!currency) {
      return new Response(
        JSON.stringify({ error: 'Moneda requerida' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Stripe espera centavos
      currency: currency.toLowerCase(),
      metadata: {
        orderId,
        ...metadata,
      },
      description: `Compra en KicksPremium - Pedido: ${orderId}`,
      // Esto es para pagos completados automáticamente
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
