import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { getSupabaseServiceClient } from '@lib/supabase';

const VIP_MONTHLY_PRICE_CENTS = 999; // 9.99€/mes
const VIP_ANNUAL_PRICE_CENTS = 8999; // 89.99€/año

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, planType = 'monthly' } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Verificar si ya tiene una suscripción activa
    const { data: existingVip } = await supabase
      .from('vip_subscriptions')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .in('status', ['active', 'pending'])
      .maybeSingle();

    if (existingVip?.status === 'active') {
      return new Response(
        JSON.stringify({ error: 'Ya tienes una suscripción VIP activa' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener usuario autenticado (opcional)
    let userId: string | null = null;
    const accessToken = cookies.get('sb-access-token')?.value;
    if (accessToken) {
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      userId = user?.id || null;
    }

    // Crear o recuperar el Stripe Customer
    let customerId: string;
    const existingCustomers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
    
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        metadata: { vip_member: 'true', user_id: userId || '' },
      });
      customerId = customer.id;
    }

    // Crear un producto y precio en Stripe (o usar existente)
    const priceAmount = planType === 'annual' ? VIP_ANNUAL_PRICE_CENTS : VIP_MONTHLY_PRICE_CENTS;
    const interval = planType === 'annual' ? 'year' : 'month';

    // Buscar precio existente
    const prices = await stripe.prices.list({
      lookup_keys: [`vip_${planType}`],
      limit: 1,
    });

    let priceId: string;
    if (prices.data.length > 0) {
      priceId = prices.data[0].id;
    } else {
      // Crear producto VIP
      let product;
      const products = await stripe.products.list({ limit: 100 });
      product = products.data.find(p => p.name === 'KicksPremium VIP Access');
      
      if (!product) {
        product = await stripe.products.create({
          name: 'KicksPremium VIP Access',
          description: 'Acceso VIP con descuentos exclusivos, notificaciones de productos nuevos y restock, acceso anticipado a drops.',
        });
      }

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceAmount,
        currency: 'eur',
        recurring: { interval },
        lookup_key: `vip_${planType}`,
      });
      priceId = price.id;
    }

    // Crear Checkout Session para suscripción
    const origin = request.headers.get('origin') || 'http://localhost:4322';

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vip/cancel`,
      locale: 'es',
      metadata: {
        type: 'vip_subscription',
        user_id: userId || '',
        email: email.toLowerCase(),
        plan_type: planType,
      },
    });

    // Crear registro pendiente en DB
    await supabase.from('vip_subscriptions').upsert({
      user_id: userId,
      email: email.toLowerCase(),
      stripe_customer_id: customerId,
      status: 'pending',
      plan_type: planType,
      price_cents: priceAmount,
    }, { onConflict: 'stripe_subscription_id' });

    return new Response(
      JSON.stringify({ url: checkoutSession.url, sessionId: checkoutSession.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating VIP subscription:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
