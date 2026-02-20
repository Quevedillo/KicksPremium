import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = import.meta.env.SITE_URL || 'https://kickspremium.victoriafp.online';

function getSupabaseServer() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

export const GET: APIRoute = async () => {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString().split('T')[0];

  // Páginas estáticas
  const staticPages: SitemapEntry[] = [
    { loc: '/', changefreq: 'daily', priority: '1.0', lastmod: now },
    { loc: '/productos', changefreq: 'daily', priority: '0.9', lastmod: now },
    { loc: '/carrito', changefreq: 'weekly', priority: '0.4', lastmod: now },
    { loc: '/servicios/legit-check', changefreq: 'monthly', priority: '0.6', lastmod: now },
    { loc: '/servicios/guia-tallas', changefreq: 'monthly', priority: '0.6', lastmod: now },
    { loc: '/servicios/envios-globales', changefreq: 'monthly', priority: '0.6', lastmod: now },
    { loc: '/servicios/devoluciones', changefreq: 'monthly', priority: '0.6', lastmod: now },
  ];

  // Categorías dinámicas desde Supabase
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, created_at')
    .order('display_order', { ascending: true });

  const categoryPages: SitemapEntry[] = (categories || []).map((cat) => ({
    loc: `/categoria/${cat.slug}`,
    lastmod: cat.created_at ? new Date(cat.created_at).toISOString().split('T')[0] : now,
    changefreq: 'weekly',
    priority: '0.7',
  }));

  // Productos dinámicos desde Supabase (solo con stock)
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at, created_at')
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  const productPages: SitemapEntry[] = (products || []).map((prod) => ({
    loc: `/productos/${prod.slug}`,
    lastmod: (prod.updated_at || prod.created_at)
      ? new Date(prod.updated_at || prod.created_at).toISOString().split('T')[0]
      : now,
    changefreq: 'weekly',
    priority: '0.8',
  }));

  const allEntries = [...staticPages, ...categoryPages, ...productPages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(SITE_URL + entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
};
