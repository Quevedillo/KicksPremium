import type { APIRoute } from 'astro';
import { getSupabaseServiceClient } from '@lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = getSupabaseServiceClient();

    // Check by email from query or by authenticated user
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    const accessToken = cookies.get('sb-access-token')?.value;
    let userId: string | null = null;

    if (accessToken) {
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      userId = user?.id || null;
    }

    if (!email && !userId) {
      return new Response(
        JSON.stringify({ isVip: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let query = supabase
      .from('vip_subscriptions')
      .select('*')
      .eq('status', 'active');

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (email) {
      query = query.eq('email', email.toLowerCase());
    }

    const { data: vipSub } = await query.maybeSingle();

    if (!vipSub) {
      return new Response(
        JSON.stringify({ isVip: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get unread notifications count
    let unreadCount = 0;
    if (userId) {
      const { count: totalNotifs } = await supabase
        .from('vip_notifications')
        .select('id', { count: 'exact', head: true });

      const { count: readNotifs } = await supabase
        .from('vip_notification_reads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      unreadCount = (totalNotifs || 0) - (readNotifs || 0);
    }

    return new Response(
      JSON.stringify({
        isVip: true,
        subscription: {
          id: vipSub.id,
          planType: vipSub.plan_type,
          status: vipSub.status,
          currentPeriodEnd: vipSub.current_period_end,
        },
        unreadNotifications: Math.max(0, unreadCount),
        discountCode: 'VIP15',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking VIP status:', error);
    return new Response(
      JSON.stringify({ isVip: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
