import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { sendNewsletterWelcomeEmail } from '@lib/email';

// POST - Subscribe to newsletter
export const POST: APIRoute = async ({ request }) => {
  try {
    // Parsear body
    const body = await request.json();
    const email = body.email?.toString().trim().toLowerCase();

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
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear suscriptor
    const { data: subscriber, error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email,
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

    // Enviar email de bienvenida
    try {
      await sendNewsletterWelcomeEmail(email);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // No fallar si falla el email, el suscriptor ya está registrado
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '¡Gracias por suscribirte! Revisa tu email para confirmar.',
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
