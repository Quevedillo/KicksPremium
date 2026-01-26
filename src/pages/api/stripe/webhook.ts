import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async (context) => {
  const signature = context.request.headers.get('stripe-signature');
  const body = await context.request.text();

  if (!signature || !webhookSecret) {
    return new Response('Signature o webhook secret no configurados', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('Error verificando webhook:', error);
    return new Response('Webhook Error', { status: 400 });
  }

  // Manejar eventos
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object as Stripe.Charge);
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;
    const userEmail = paymentIntent.metadata.userEmail;

    if (!orderId) {
      console.error('Order ID no encontrado en metadata');
      return;
    }

    // Actualizar orden en la base de datos
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error actualizando orden:', error);
      return;
    }

    // Aquí puedes enviar un email de confirmación
    console.log(`Pago exitoso para orden ${orderId}`);
  } catch (error) {
    console.error('Error procesando pago exitoso:', error);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      console.error('Order ID no encontrado en metadata');
      return;
    }

    // Actualizar orden con estado fallido
    await supabase
      .from('orders')
      .update({
        payment_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    console.log(`Pago fallido para orden ${orderId}`);
  } catch (error) {
    console.error('Error procesando pago fallido:', error);
  }
}

async function handleRefund(charge: Stripe.Charge) {
  try {
    const paymentIntentId = charge.payment_intent as string;

    // Buscar la orden por payment_intent_id
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_intent_id', paymentIntentId)
      .limit(1);

    if (error || !orders || orders.length === 0) {
      console.error('Orden no encontrada para reembolso');
      return;
    }

    const orderId = orders[0].id;

    // Actualizar orden con estado reembolsado
    await supabase
      .from('orders')
      .update({
        payment_status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    console.log(`Reembolso procesado para orden ${orderId}`);
  } catch (error) {
    console.error('Error procesando reembolso:', error);
  }
}
