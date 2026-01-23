import type { APIRoute } from 'astro';

// POST - Send cancellation email when user cancels checkout
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Import dynamically to avoid issues
    const { sendAbandonedCartEmail } = await import('@lib/email');

    // Send abandoned cart / cancellation notification
    try {
      await sendAbandonedCartEmail(email);
      console.log(`✅ Notificación de cancelación enviada a ${email}`);
    } catch (emailError) {
      console.error('⚠️ Error enviando email de cancelación:', emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-cancel:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
