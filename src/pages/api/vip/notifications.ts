import type { APIRoute } from 'astro';
import { getSupabaseServiceClient } from '@lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = getSupabaseServiceClient();
    const accessToken = cookies.get('sb-access-token')?.value;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Sesión inválida' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check VIP status
    const { data: vipSub } = await supabase
      .from('vip_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!vipSub) {
      return new Response(
        JSON.stringify({ error: 'No eres miembro VIP' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get notifications
    const { data: notifications } = await supabase
      .from('vip_notifications')
      .select('*, vip_notification_reads!left(user_id)')
      .order('created_at', { ascending: false })
      .limit(50);

    // Get read notification IDs for this user
    const { data: readNotifs } = await supabase
      .from('vip_notification_reads')
      .select('notification_id')
      .eq('user_id', user.id);

    const readIds = new Set(readNotifs?.map(r => r.notification_id) || []);

    const enrichedNotifs = (notifications || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      productId: n.product_id,
      metadata: n.metadata,
      createdAt: n.created_at,
      isRead: readIds.has(n.id),
    }));

    return new Response(
      JSON.stringify({ notifications: enrichedNotifs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching VIP notifications:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Mark notification as read
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = getSupabaseServiceClient();
    const accessToken = cookies.get('sb-access-token')?.value;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Sesión inválida' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { notificationId } = body;

    if (notificationId) {
      await supabase
        .from('vip_notification_reads')
        .upsert({ notification_id: notificationId, user_id: user.id }, { onConflict: 'notification_id,user_id' });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
