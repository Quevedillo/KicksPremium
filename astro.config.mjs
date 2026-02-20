import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.SITE_URL || 'https://kickspremium.com',
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: true,
      nesting: true,
    }),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // Usar el mismo dominio configurado en site
      baseUrl: process.env.SITE_URL || 'https://kickspremium.com',
      // Ser selectivo con las rutas
      filter: (page) => {
        // Excluir rutas admin, auth y checkout del sitemap
        if (
          page.includes('/admin/') ||
          page.includes('/auth/') ||
          page.includes('/api/') ||
          page.includes('/checkout')
        ) {
          return false;
        }
        return true;
      },
      // Configurar prioridades diferentes por tipo de página
      serialize: (item) => {
        if (item.url.includes('/productos/')) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/categoria/')) {
          item.priority = 0.7;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/servicios/')) {
          item.priority = 0.6;
          item.changefreq = 'monthly';
        } else {
          item.priority = 0.5;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
  vite: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  },
});
