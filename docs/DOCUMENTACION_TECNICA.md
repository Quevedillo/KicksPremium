KicksPremium — Resumen técnico (versión reducida)

Versión: 0.1.0 · Última actualización: Febrero 2026
URL producción: https://kickspremium.victoriafp.online

Objetivo (rápido)
Plataforma e‑commerce de zapatillas premium con panel admin, checkout con Stripe, facturación en PDF y control de stock por tallas. Esta versión contiene sólo lo esencial para operar, desplegar y entender la arquitectura general.

Visión general del stack
- Front / SSR: Astro con componentes React (Islands).
- Lenguaje: TypeScript.
- Estilos: Tailwind CSS.
- Base de datos: Supabase (Postgres) con Row Level Security (RLS).
- Pagos: Stripe (Checkout + webhooks).
- Imágenes: Cloudinary.
- Emails / PDFs: Nodemailer + PDFKit.

Dónde mirar en el repo
- Código: [src/](src/)
- API y webhooks: [src/pages/api/](src/pages/api/)
- Middleware global: [src/middleware.ts](src/middleware.ts)
- Esquema + funciones BD: `DATABASE_OPTIMIZED.sql`

Flujo clave de compra (resumido)
1. Usuario añade productos y talla al carrito (cliente: localStorage).
2. `POST /api/checkout/create-session` valida stock y crea sesión de Stripe.
3. Pago completado → Stripe envía `checkout.session.completed` a `/api/webhooks/stripe`.
4. Webhook: crea pedido, reduce stock (RPC atómico), genera factura PDF, registra invoice y envía email con adjunto.

Puntos operativos importantes
- Soporta guest checkout; pedidos guest consultables por email y linkables a cuentas registradas.
- Stock por tallas almacenado en JSON por producto; las RPCs garantizan operaciones atómicas.
- Facturas: secuencia F-YYYY-NNNNN (rectificativas R-YYYY-NNNNN). Generación con `src/lib/invoice.ts`.

Seguridad (resumen)
- RLS en todas las tablas: lectura pública para catálogo, escritura admin‑only.
- Auth: Supabase Auth; tokens en cookies HttpOnly.
- Middleware añade headers de seguridad y popula `Astro.locals.user`.

Variables de entorno críticas
 (mínimo para producción)
- `SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_STRIPE_PUBLIC_KEY`
- `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `PUBLIC_CLOUDINARY_CLOUD_NAME`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`
- `SITE_URL`, `PUBLIC_ADMIN_EMAIL`

Comandos esenciales
- Desarrollo: `npm run dev`
- Compilar: `npm run build`
- Previsualizar build: `npm run preview`

Despliegue (resumen rápido)
- Docker multi‑stage incluido en el repo. Puerto por defecto: 4321.
- Pasos mínimos:
  1. `docker build -t kickspremium .`
  2. `docker run -d --name kickspremium -p 4321:4321 --env-file .env kickspremium`
  3. Verificar healthcheck y logs del contenedor.

Integraciones críticas
- Stripe: registrar webhook a `https://<SITE_URL>/api/webhooks/stripe` para `checkout.session.completed` y configurar `STRIPE_WEBHOOK_SECRET`.
- Cloudinary: credenciales para subida/transformación de imágenes.
- SMTP: credenciales para envío de emails y facturas.

Admin y operaciones (breve)
- Rutas admin bajo `/admin` y endpoints `/api/admin/*` requieren `is_admin` en `user_profiles`.
- El panel admin permite CRUD de productos (con tallas), gestión de pedidos, descuentos y usuarios.

APIs (visión ágil)
- Autenticación: `/api/auth/*` — login, register, me, logout.
- Checkout: `/api/checkout/*` y `/api/webhooks/stripe`.
- Pedidos: `/api/orders/*` — cancel, download invoice, by-email.
- Descuentos: `/api/discount/validate`.
- Admin: `/api/admin/*` — productos, pedidos, finanzas, usuarios.

Recomendaciones operativas rápidas
- No exponer claves secretas; usar `PUBLIC_` solo para valores seguros en cliente.
- Monitorizar webhooks de Stripe y configurar reintentos en caso de fallos.
- Verificar periódicamente sincronía entre `sizes_available` y stock total; hay triggers/RPCs para apoyo.
- Implementar tests para RPCs de stock, webhook de Stripe y generación de PDFs.

Contacto / siguiente paso
Documento reducido listo. Si quieres, exporto esto a PDF listo para imprimir o genero un `README.md` de una página. Dime qué formato prefieres.

--
*Versión reducida: para detalles técnicos y SQL consultar `DATABASE_OPTIMIZED.sql` y las rutas en `src/pages/api/`.*
