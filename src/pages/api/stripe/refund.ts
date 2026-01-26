import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');

interface RefundRequest {
  paymentIntentId: string;
  reason?: string;
}

export const POST: APIRoute = async (context) => {
  try {
    // Verificar que el usuario sea administrador
    const authHeader = context.request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: RefundRequest = await context.request.json();
    const { paymentIntentId, reason } = body;

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: 'Payment Intent ID requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Procesar reembolso
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: reason as any || 'requested_by_customer',
    });

    return new Response(
      JSON.stringify({
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100, // Convertir de centavos a euros
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing refund:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
