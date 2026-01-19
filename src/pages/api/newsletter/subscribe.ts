import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { sendNewsletterWelcomeEmail } from '@lib/email';

// Generar código único de descuento
function generateDiscountCode(): string {
  const prefix = 'KICK';
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

// POST - Subscribe to newsletter
export const POST: APIRoute = async ({ request }) => {
  try {
    // Parsear body
    const body = await request.json();
    const email = body.email?.toString().trim().toLowerCase();
    const source = body.source || 'footer';
    const generateCode = body.generateDiscountCode === true;

    // Validar email
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ya estás suscrito a nuestro newsletter',
          discountCode: 'WELCOME10', // Dar el código general si ya está suscrito
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generar código de descuento único si se solicita
    let discountCode = 'WELCOME10';
    if (generateCode) {
      discountCode = generateDiscountCode();
      
      // Crear código en la base de datos
      const { error: codeError } = await supabase
        .from('discount_codes')
        .insert({
          code: discountCode,
          description: `Código de bienvenida para ${email}`,
          discount_type: 'percentage',
          discount_value: 10,
          min_purchase: 5000, // 50€ mínimo
          max_uses: 1,
          max_uses_per_user: 1,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
        });

      if (codeError) {
        console.error('Error creating discount code:', codeError);
        // Usar código general si falla
        discountCode = 'WELCOME10';
      }
    }

    // Crear suscriptor
    const { data: subscriber, error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email,
        source,
        verified: true, // Marcar como verificado automáticamente
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating newsletter subscriber:', error);
      return new Response(
        JSON.stringify({ error: 'Error al suscribirse al newsletter' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Enviar email de bienvenida con código de descuento
    try {
      const emailResult = await sendNewsletterWelcomeEmail(email, discountCode);
      console.log(`✅ Email de bienvenida enviado a ${email}:`, emailResult);
    } catch (emailError) {
      console.error(`❌ Error enviando email a ${email}:`, emailError);
      // Log más detallado
      if (emailError instanceof Error) {
        console.error('Detalles del error:', {
          message: emailError.message,
          stack: emailError.stack,
        });
      }
      // No fallar si falla el email, el suscriptor ya está registrado
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '¡Gracias por suscribirte! Revisa tu email para tu código de descuento.',
        discountCode,
        subscriber,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en POST /api/newsletter/subscribe:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Validar formato de email
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
