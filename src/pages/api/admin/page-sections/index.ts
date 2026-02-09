import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';

// GET - List all page sections
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.setSession({
      access_token: accessToken, refresh_token: refreshToken,
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: adminProfile } = await supabase
      .from('user_profiles').select('is_admin').eq('id', user.id).single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = getSupabaseServiceClient();
    const { data: sections, error } = await serviceClient
      .from('page_sections')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching page sections:', error);
      return new Response(JSON.stringify({ error: 'Error fetching sections' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get featured product selections for each section
    const sectionIds = (sections || []).map(s => s.id);
    const { data: selections } = await serviceClient
      .from('featured_product_selections')
      .select('*, products(id, name, slug, brand, price, images, stock)')
      .in('section_id', sectionIds)
      .order('display_order');

    // Get all products for selection picker
    const { data: allProducts } = await serviceClient
      .from('products')
      .select('id, name, slug, brand, price, images, stock, is_limited_edition')
      .order('name');

    return new Response(JSON.stringify({
      sections: sections || [],
      selections: selections || [],
      products: allProducts || [],
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Create a new section
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.setSession({
      access_token: accessToken, refresh_token: refreshToken,
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: adminProfile } = await supabase
      .from('user_profiles').select('is_admin').eq('id', user.id).single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const serviceClient = getSupabaseServiceClient();

    const { data, error } = await serviceClient
      .from('page_sections')
      .insert({
        section_type: body.section_type,
        title: body.title || '',
        subtitle: body.subtitle || '',
        content: body.content || {},
        display_order: body.display_order || 0,
        is_visible: body.is_visible !== false,
        settings: body.settings || {},
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, section: data }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PUT - Update section(s) - supports bulk order updates
export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.setSession({
      access_token: accessToken, refresh_token: refreshToken,
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: adminProfile } = await supabase
      .from('user_profiles').select('is_admin').eq('id', user.id).single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const serviceClient = getSupabaseServiceClient();

    // Handle bulk order update
    if (body.reorder && Array.isArray(body.reorder)) {
      for (const item of body.reorder) {
        await serviceClient
          .from('page_sections')
          .update({ display_order: item.display_order })
          .eq('id', item.id);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle single section update
    if (body.id) {
      const updateData: any = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.is_visible !== undefined) updateData.is_visible = body.is_visible;
      if (body.settings !== undefined) updateData.settings = body.settings;
      if (body.display_order !== undefined) updateData.display_order = body.display_order;

      const { data, error } = await serviceClient
        .from('page_sections')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle featured products update
      if (body.product_ids && Array.isArray(body.product_ids)) {
        // Remove existing selections
        await serviceClient
          .from('featured_product_selections')
          .delete()
          .eq('section_id', body.id);

        // Insert new selections
        if (body.product_ids.length > 0) {
          const selections = body.product_ids.map((pid: string, idx: number) => ({
            section_id: body.id,
            product_id: pid,
            display_order: idx,
          }));
          await serviceClient
            .from('featured_product_selections')
            .insert(selections);
        }
      }

      return new Response(JSON.stringify({ success: true, section: data }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'ID requerido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE - Remove a section
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.setSession({
      access_token: accessToken, refresh_token: refreshToken,
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: adminProfile } = await supabase
      .from('user_profiles').select('is_admin').eq('id', user.id).single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const serviceClient = getSupabaseServiceClient();

    const { error } = await serviceClient
      .from('page_sections')
      .delete()
      .eq('id', body.id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
