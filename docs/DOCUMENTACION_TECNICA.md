# KicksPremium — Documentación Técnica

**Versión:** 0.1.0  
**URL de Producción:** https://kickspremium.victoriafp.online  
**Fecha de generación:** Julio 2025

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Páginas Públicas](#5-páginas-públicas)
6. [Panel de Administración](#6-panel-de-administración)
7. [API REST — Endpoints](#7-api-rest--endpoints)
8. [Componentes Interactivos (Islands)](#8-componentes-interactivos-islands)
9. [Gestión de Estado (Client-Side)](#9-gestión-de-estado-client-side)
10. [Bibliotecas Internas](#10-bibliotecas-internas)
11. [Base de Datos](#11-base-de-datos)
12. [Autenticación y Seguridad](#12-autenticación-y-seguridad)
13. [Pasarela de Pago (Stripe)](#13-pasarela-de-pago-stripe)
14. [Sistema de Facturación](#14-sistema-de-facturación)
15. [Sistema de Emails](#15-sistema-de-emails)
16. [Gestión de Imágenes (Cloudinary)](#16-gestión-de-imágenes-cloudinary)
17. [SEO y Rendimiento](#17-seo-y-rendimiento)
18. [Variables de Entorno](#18-variables-de-entorno)
19. [Despliegue con Docker](#19-despliegue-con-docker)
20. [Comandos de Desarrollo](#20-comandos-de-desarrollo)
21. [Dependencias del Proyecto](#21-dependencias-del-proyecto)

---

## 1. Descripción General

**KicksPremium** es una tienda online (e-commerce) especializada en zapatillas premium para hombre. La aplicación ofrece:

- **Catálogo de productos** con filtros avanzados (marca, color, categoría, precio, talla, búsqueda en tiempo real)
- **Carrito de compras** persistente en el navegador
- **Checkout seguro** con Stripe (usuarios registrados e invitados)
- **Panel de administración** completo con dashboard de KPIs, CRUD de productos, gestión de pedidos, finanzas, descuentos, categorías, usuarios y personalización visual del sitio
- **Facturación PDF** profesional con IVA 21% y numeración secuencial
- **Newsletter** con suscripción, popup y gestión desde admin
- **Sistema de stock por tallas** con control atómico ante compras concurrentes
- **Emails transaccionales** (confirmación, cancelación, devolución) con facturas adjuntas

---

## 2. Stack Tecnológico

| Tecnología | Versión | Propósito |
|---|---|---|
| **Astro** | 5.0 | Framework principal — SSR (Server-Side Rendering) |
| **React** | 18.2 | Componentes interactivos (arquitectura de islas) |
| **TypeScript** | 5.9 | Tipado estático con modo estricto |
| **Tailwind CSS** | 3.3 | Framework de estilos utility-first |
| **Supabase** | 2.39 | Backend-as-a-Service (PostgreSQL + Auth + RLS) |
| **Stripe** | 20.1 | Pasarela de pagos (Checkout Sessions, Webhooks, Refunds) |
| **Cloudinary** | 2.8 | CDN de imágenes con optimización automática |
| **Nodemailer** | 6.10 | Envío de emails SMTP (Gmail) |
| **PDFKit** | 0.17 | Generación de facturas PDF |
| **Nanostores** | 0.10 | Estado global client-side (carrito, autenticación) |
| **Node.js** | 22 (Alpine) | Runtime de producción |
| **Docker** | Multi-stage | Contenedorización y despliegue |

---

## 3. Arquitectura del Sistema

### 3.1 Patrón arquitectónico: Islands Architecture

KicksPremium utiliza la arquitectura de islas de Astro. Las páginas se renderizan como HTML estático en el servidor, y solo los componentes interactivos (React) se hidratan en el cliente. Esto ofrece:

- **Carga rápida**: el HTML llega completamente renderizado
- **JavaScript mínimo**: solo se carga JS donde se necesita interactividad
- **SEO óptimo**: todo el contenido es indexable

### 3.2 Renderizado

- **Modo**: `output: 'server'` — todas las páginas se renderizan en el servidor (SSR)
- **Adaptador**: `@astrojs/node` en modo `standalone`
- **Puerto**: 4321

### 3.3 Flujo de datos

```
┌─────────────┐     ┌────────────────┐     ┌────────────────┐
│   Cliente    │────▶│  Astro (SSR)   │────▶│   Supabase     │
│  (Navegador) │     │  + API Routes  │     │  (PostgreSQL)  │
└─────────────┘     └────────────────┘     └────────────────┘
       │                    │                       │
       │                    ├──────▶ Stripe          │
       │                    ├──────▶ Cloudinary      │
       │                    └──────▶ SMTP (Gmail)    │
       │                                            │
       └──── Nanostores (cart/auth) ◀── localStorage │
```

### 3.4 Capas de la aplicación

| Capa | Responsabilidad | Tecnologías |
|---|---|---|
| **Presentación** | Páginas Astro + Islands React | Astro, React, Tailwind |
| **Estado cliente** | Carrito, autenticación | Nanostores, localStorage, cookies |
| **API** | Endpoints REST | Astro API Routes (`src/pages/api/`) |
| **Middleware** | Auth, seguridad, headers | Astro Middleware (`src/middleware.ts`) |
| **Servicios** | Pagos, email, imágenes, PDF | Stripe, Nodemailer, Cloudinary, PDFKit |
| **Datos** | Persistencia, RLS, RPCs | Supabase (PostgreSQL) |

---

## 4. Estructura del Proyecto

```
KicksPremium/
├── astro.config.mjs          # Configuración de Astro (SSR, React, Tailwind)
├── tailwind.config.mjs       # Paleta de colores y extensiones Tailwind
├── tsconfig.json             # TypeScript con aliases de paths
├── package.json              # Dependencias y scripts
├── Dockerfile                # Build multi-stage Node 22 Alpine
├── DATABASE_OPTIMIZED.sql    # Schema SQL completo (12 tablas + RPCs)
├── public/                   # Assets estáticos
│   └── sitemap.xsl           # Transformación XSL para sitemap
├── scripts/                  # Scripts de utilidad
│   ├── add-sitemap-xsl.mjs
│   ├── test-email-functions.mjs
│   ├── test-resend.mjs
│   └── test-smtp.mjs
├── docs/                     # Documentación del proyecto
└── src/
    ├── env.d.ts              # Tipos de entorno Astro
    ├── middleware.ts          # Auth + headers de seguridad
    ├── components/            # Componentes reutilizables
    │   ├── AdminGuard.tsx     # Protección client-side para admin
    │   ├── Header.astro       # Cabecera con navegación
    │   ├── NewsletterSection.astro
    │   ├── islands/           # Componentes React interactivos
    │   ├── product/           # Componentes de producto
    │   └── ui/                # Componentes de UI genéricos
    ├── layouts/               # Layouts de página
    │   ├── BaseLayout.astro   # Layout base con <head>, meta, Open Graph
    │   ├── PublicLayout.astro # Layout público (Header + Footer)
    │   └── AdminLayout.astro  # Layout admin (sidebar + protección)
    ├── lib/                   # Bibliotecas y configuración
    │   ├── supabase.ts        # Clientes Supabase (anon + service)
    │   ├── stripe.ts          # Instancia Stripe
    │   ├── email.ts           # Templates y envío de emails
    │   ├── invoice.ts         # Generación de facturas PDF
    │   ├── cloudinary.ts      # URLs optimizadas de Cloudinary
    │   ├── types.ts           # Tipos TypeScript centralizados
    │   ├── utils.ts           # Utilidades (formatPrice, slugify, etc.)
    │   └── auth-init.ts       # Auto-inicialización de auth
    ├── pages/                 # Páginas y API routes
    │   ├── index.astro        # Home (hero, marcas, productos, ofertas)
    │   ├── carrito.astro      # Página del carrito
    │   ├── mi-cuenta.astro    # Perfil del usuario
    │   ├── pedidos.astro      # Historial de pedidos
    │   ├── unsubscribe.astro  # Desuscripción newsletter
    │   ├── sitemap.xml.ts     # Sitemap dinámico
    │   ├── admin/             # Panel de administración (12 páginas)
    │   ├── api/               # API REST (~35 endpoints)
    │   ├── auth/              # Páginas de autenticación
    │   ├── categoria/         # Páginas de categoría
    │   ├── checkout/          # Success/Cancel de Stripe
    │   ├── productos/         # Catálogo y detalle de producto
    │   └── servicios/         # Páginas informativas
    ├── stores/                # Estado global (Nanostores)
    │   ├── auth.ts            # Estado de autenticación
    │   └── cart.ts            # Estado del carrito
    └── styles/
        └── global.css         # Estilos globales + animaciones
```

---

## 5. Páginas Públicas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `index.astro` | **Home** — Hero, barra de marcas, categorías, productos destacados, ofertas flash, newsletter |
| `/productos` | `productos/index.astro` | **Catálogo** — Grid de productos con filtros (marca, color, categoría, precio, búsqueda), ordenación, paginación |
| `/productos/:slug` | `productos/[slug].astro` | **Detalle de producto** — Galería, selector de talla con stock, recomendador de talla, descripción detallada, productos relacionados |
| `/categoria/:slug` | `categoria/[slug].astro` | **Categoría** — Productos filtrados por categoría |
| `/carrito` | `carrito.astro` | **Carrito** — Lista de items, cantidades, código de descuento, resumen de precio, acceso a checkout |
| `/checkout/success` | `checkout/success.astro` | **Pago exitoso** — Confirmación con detalles del pedido |
| `/checkout/cancel` | `checkout/cancel.astro` | **Pago cancelado** — Mensaje y enlace para reintentar |
| `/auth/login` | `auth/login.astro` | **Login/Registro** — Formulario unificado de autenticación |
| `/mi-cuenta` | `mi-cuenta.astro` | **Mi cuenta** — Perfil del usuario, datos personales |
| `/pedidos` | `pedidos.astro` | **Mis pedidos** — Historial con estados, descarga de factura, cancelación. Soporta consulta por email (guest) |
| `/unsubscribe` | `unsubscribe.astro` | **Desuscripción** — Baja del newsletter |
| `/servicios/envios` | `servicios/envios.astro` | Política de envíos |
| `/servicios/devoluciones` | `servicios/devoluciones.astro` | Política de devoluciones |
| `/servicios/privacidad` | `servicios/privacidad.astro` | Política de privacidad |
| `/servicios/terminos` | `servicios/terminos.astro` | Términos y condiciones |
| `/sitemap.xml` | `sitemap.xml.ts` | Sitemap XML dinámico con todos los productos y categorías |

---

## 6. Panel de Administración

Todas las rutas bajo `/admin` están protegidas por middleware. Solo usuarios con `is_admin = true` en `user_profiles` tienen acceso.

| Ruta | Descripción |
|---|---|
| `/admin` | **Dashboard** — KPIs (ventas, pedidos, productos, clientes), gráficos, pedidos recientes |
| `/admin/productos` | **Productos** — CRUD completo, búsqueda, filtros, stock por tallas |
| `/admin/productos/nuevo` | Creación de nuevo producto con subida de imágenes a Cloudinary |
| `/admin/productos/[id]` | Edición de producto existente |
| `/admin/pedidos` | **Pedidos** — Listado, cambio de estado (paid→shipped→delivered→cancelled), cancelación/reembolso |
| `/admin/finanzas` | **Finanzas** — Ingresos, balance de Stripe, transacciones, métricas financieras |
| `/admin/descuentos` | **Descuentos** — CRUD de códigos de descuento (porcentaje/fijo, límites, expiración) |
| `/admin/categorias` | **Categorías** — Gestión de categorías de productos |
| `/admin/usuarios` | **Usuarios** — Listado, búsqueda, asignación de rol admin, eliminación |
| `/admin/personalizacion` | **Personalización** — Editor visual de secciones de la home (Page Customizer) |
| `/admin/configuracion` | **Configuración** — Ajustes generales del sitio |

---

## 7. API REST — Endpoints

Todos los endpoints están bajo `/api/` y responden en formato JSON.

### 7.1 Autenticación (`/api/auth/`)

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión (email + contraseña). Establece cookies HttpOnly | No |
| POST | `/api/auth/register` | Crear cuenta nueva | No |
| POST | `/api/auth/logout` | Cerrar sesión. Elimina cookies | No |
| GET | `/api/auth/me` | Obtener datos del usuario autenticado | Sí |
| POST | `/api/auth/update-profile` | Actualizar perfil (nombre, email) | Sí |
| POST | `/api/auth/change-password` | Cambiar contraseña | Sí |
| GET | `/api/auth/download-data` | Descargar datos personales (GDPR) | Sí |

### 7.2 Checkout y Pagos (`/api/checkout/`, `/api/stripe/`)

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| POST | `/api/checkout/create-session` | Crear sesión de Stripe Checkout. Valida stock en servidor (409 si insuficiente) | No (soporta guest) |
| GET | `/api/checkout/session-status` | Estado de una sesión de Stripe | No |
| POST | `/api/webhooks/stripe` | Webhook de Stripe (`checkout.session.completed`). Crea pedido, reduce stock atómicamente, genera factura, envía email | Stripe signature |
| GET | `/api/stripe/balance` | Obtener balance de Stripe | Admin |

### 7.3 Pedidos (`/api/orders/`)

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| POST | `/api/orders/cancel` | Cancelar pedido. Restaura stock, crea factura rectificativa, reembolso Stripe, email | Sí / Guest email |
| POST | `/api/orders/request-return` | Solicitar devolución (solo pedidos entregados) | Sí |
| GET | `/api/orders/download-invoice` | Descargar factura PDF del pedido | Sí / Guest email |
| GET | `/api/orders/by-email` | Obtener pedidos por email (para guest checkout) | No |

### 7.4 Descuentos (`/api/discount/`)

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| POST | `/api/discount/validate` | Validar código de descuento (existencia, vigencia, límites) | No |

### 7.5 Newsletter (`/api/newsletter/`)

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| POST | `/api/newsletter/subscribe` | Suscribirse al newsletter | No |
| POST | `/api/newsletter/unsubscribe` | Desuscribirse del newsletter | No |

### 7.6 Otros

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| GET | `/api/search` | Búsqueda de productos en tiempo real (LiveSearch) | No |
| POST | `/api/upload` | Subir imagen a Cloudinary | Admin |
| POST | `/api/sync/products` | Sincronización de productos | Admin |

### 7.7 API de Administración (`/api/admin/`)

Todos los endpoints admin requieren autenticación y rol `is_admin`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/dashboard` | Datos del dashboard (KPIs, ventas, pedidos recientes) |
| GET | `/api/admin/products` | Listar productos (con búsqueda y filtros) |
| POST | `/api/admin/products` | Crear producto |
| GET | `/api/admin/products/[id]` | Detalle de producto |
| PUT | `/api/admin/products/[id]` | Actualizar producto |
| DELETE | `/api/admin/products/[id]` | Eliminar producto |
| GET | `/api/admin/orders` | Listar pedidos |
| GET | `/api/admin/orders/[id]` | Detalle de pedido |
| PUT | `/api/admin/orders/[id]/status` | Cambiar estado del pedido (shipped/delivered/cancelled) |
| GET | `/api/admin/categories` | Listar categorías |
| POST | `/api/admin/categories` | Crear categoría |
| PUT | `/api/admin/categories/[id]` | Actualizar categoría |
| DELETE | `/api/admin/categories/[id]` | Eliminar categoría |
| GET | `/api/admin/finance` | Datos financieros |
| GET | `/api/admin/discounts` | Listar descuentos |
| POST | `/api/admin/discounts` | Crear código de descuento |
| PUT | `/api/admin/discounts/[id]` | Actualizar descuento |
| DELETE | `/api/admin/discounts/[id]` | Eliminar descuento |
| GET | `/api/admin/users` | Listar usuarios |
| PUT | `/api/admin/users/[id]` | Actualizar usuario (toggle admin) |
| DELETE | `/api/admin/users/[id]` | Eliminar usuario |
| GET | `/api/admin/newsletter` | Listar suscriptores |
| DELETE | `/api/admin/newsletter/[id]` | Eliminar suscriptor |
| GET | `/api/admin/page-sections` | Obtener secciones de personalización |
| PUT | `/api/admin/page-sections` | Actualizar secciones |

---

## 8. Componentes Interactivos (Islands)

Los componentes React se hidratan en el cliente usando directivas de Astro:

| Componente | Directiva | Descripción |
|---|---|---|
| `AddToCartButton` | `client:load` | Botón de añadir al carrito con selector de talla y cantidad |
| `CartIcon` | `client:only="react"` | Icono del carrito con badge de cantidad en tiempo real |
| `CartSlideOver` | `client:only="react"` | Panel lateral deslizante del carrito con resumen y checkout |
| `LiveSearch` | `client:load` | Barra de búsqueda con resultados en tiempo real (debounce) |
| `UserMenu` | `client:only="react"` | Menú de usuario (login/registro/mi cuenta/cerrar sesión) |
| `AuthForm` | `client:load` | Formulario de login/registro con validación |
| `SizePicker` | `client:load` | Selector de talla mostrando disponibilidad de stock |
| `SizeSelector` | `client:load` | Selector de talla para filtros del catálogo |
| `SizeRecommender` | `client:load` | Recomendador de talla por centímetros del pie |
| `NewsletterPopup` | `client:load` | Popup de suscripción al newsletter (con delay) |
| `AdminDashboard` | `client:only="react"` | Dashboard de administración con KPIs y gráficos |
| `AdminUsersDashboard` | `client:only="react"` | Gestión de usuarios del sistema |
| `CloudinaryImageUpload` | `client:only="react"` | Subida de imágenes con drag & drop a Cloudinary |
| `PageCustomizer` | `client:only="react"` | Editor visual de secciones de la homepage |
| `AdminGuard` | `client:only="react"` | Componente de protección de rutas admin (client-side) |
| `DataLoader` | `client:load` | Componente genérico para carga de datos con estados loading/error |
| `LoadingSpinner` | — | Indicador de carga visual |
| `PageTransition` | — | Transiciones entre páginas |
| `KicksPremiumLogo` | — | Logo SVG del sitio |

---

## 9. Gestión de Estado (Client-Side)

Se utiliza **Nanostores** para manejar el estado global en el cliente, con persistencia en `localStorage`.

### 9.1 Store de Autenticación (`stores/auth.ts`)

| Export | Tipo | Descripción |
|---|---|---|
| `authStore` | `atom` | Estado del usuario actual (id, email, role, full_name, is_admin) |
| `initializeAuth()` | Función | Inicializa auth desde cookies/Supabase al cargar la página |
| `login(email, password)` | Función | Login con Supabase Auth + cookies HttpOnly |
| `register(email, password, name)` | Función | Registro + creación de perfil |
| `logout()` | Función | Cierre de sesión + limpieza de cookies |
| `getCurrentUser()` | Función | Obtener usuario actual |
| `checkIsAdmin()` | Función | Verificar si el usuario es administrador |

### 9.2 Store del Carrito (`stores/cart.ts`)

| Export | Tipo | Descripción |
|---|---|---|
| `cartStore` | `atom` | Estado del carrito (items, isOpen, discountCode, discountAmount, discountType) |
| `addToCart(item)` | Función | Añadir producto con talla y cantidad |
| `removeFromCart(itemId, size)` | Función | Eliminar item del carrito |
| `updateCartItemQuantity(itemId, size, qty)` | Función | Actualizar cantidad |
| `applyDiscountCode(code)` | Función | Aplicar código de descuento (valida con API) |
| `removeDiscountCode()` | Función | Eliminar descuento aplicado |
| `clearCart()` | Función | Vaciar carrito |
| `toggleCart()` / `openCart()` / `closeCart()` | Función | Control del panel lateral |
| `cartSubtotal` | `computed` | Subtotal calculado |
| `discountAmount` | `computed` | Monto del descuento |
| `cartTotal` | `computed` | Total con descuento |
| `cartItemCount` | `computed` | Número de items |

---

## 10. Bibliotecas Internas

### `src/lib/supabase.ts`
- **Cliente público** (`supabase`): singleton con `ANON_KEY` para operaciones client-side
- **Cliente de servicio** (`getSupabaseServiceClient()`): con `SERVICE_ROLE_KEY`, bypassa RLS para operaciones de backend. Se crea nuevo en cada invocación server-side

### `src/lib/stripe.ts`
- Exporta instancia `stripe` (server-side) y `STRIPE_PUBLIC_KEY` (client-side)

### `src/lib/email.ts`
- Transporte SMTP via Nodemailer (Gmail por defecto)
- Templates HTML para: confirmación de pedido, cancelación, devolución, bienvenida newsletter
- Soporte para adjuntos (facturas PDF)
- Notificaciones automáticas al administrador

### `src/lib/invoice.ts`
- Generación de facturas PDF con PDFKit
- Formato profesional: logo, datos fiscales de empresa, desglose IVA 21%
- Facturas estándar (F-YYYY-NNNNN) y rectificativas (R-YYYY-NNNNN)
- Importes negativos en rojo para rectificativas
- Datos de envío, items con imagen, totales desglosados

### `src/lib/cloudinary.ts`
- URLs optimizadas con transformaciones automáticas (WebP, responsive)
- Funciones: `getGalleryImageUrl()`, `getThumbnailUrl()`, `getResponsiveImageUrls()`, `getAspectRatioUrl()`

### `src/lib/types.ts`
Tipos TypeScript centralizados:
- `Category`, `Product`, `CartItem`, `Order`, `OrderItem`
- `UserProfile`, `DiscountCode`, `PageSection`, `NewsletterSubscriber`
- `NormalizedOrderItem`, `StockRpcResult`, `ShippingAddress`, `ProductDetailedDescription`

### `src/lib/utils.ts`
- `formatPrice(cents)` — Formato EUR (ej: 12.999 → "129,99 €")
- `slugify(text)` — Generación de slugs URL-friendly
- `isValidEmail(email)` — Validación de email
- `normalizeOrderItem()` / `enrichOrderItems()` — Normalización de items de pedido
- `truncateText()`, `getInitials()`, `delay()`, `deepClone()`

---

## 11. Base de Datos

### 11.1 Motor
**Supabase (PostgreSQL)** con Row Level Security (RLS) habilitado en todas las tablas.

### 11.2 Esquema de tablas (12 tablas)

#### `user_profiles`
Perfil de usuarios vinculado a `auth.users` de Supabase.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK, FK → auth.users) | ID del usuario |
| `email` | TEXT (UNIQUE) | Email |
| `full_name` | TEXT | Nombre completo |
| `is_admin` | BOOLEAN | Rol de administrador |
| `created_at` | TIMESTAMPTZ | Creación |
| `updated_at` | TIMESTAMPTZ | Actualización |

#### `brands`
Marcas de zapatillas.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `name` | VARCHAR (UNIQUE) | Nombre |
| `slug` | VARCHAR (UNIQUE) | Slug URL |
| `logo_url` | TEXT | URL del logo |
| `description` | TEXT | Descripción |
| `display_order` | INTEGER | Orden de visualización |
| `is_featured` | BOOLEAN | Destacada |

#### `categories`
Categorías de productos (Running, Lifestyle, Basketball, etc.).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `name` | VARCHAR | Nombre |
| `slug` | VARCHAR (UNIQUE) | Slug URL |
| `description` | TEXT | Descripción |
| `icon` | VARCHAR | Icono/emoji |
| `display_order` | INTEGER | Orden |

#### `colors`
Catálogo de colores disponibles.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `name` | VARCHAR | Nombre del color |
| `slug` | VARCHAR (UNIQUE) | Slug |
| `hex_code` | VARCHAR | Código hexadecimal |
| `display_order` | INTEGER | Orden |

#### `products`
Productos del catálogo. Tabla central del sistema.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `name` | VARCHAR | Nombre del producto |
| `slug` | VARCHAR (UNIQUE) | Slug URL |
| `description` | TEXT | Descripción corta |
| `detailed_description` | JSONB | Descripción detallada (materiales, fit, cuidado) |
| `price` | INTEGER (≥ 0) | Precio en **céntimos** EUR |
| `original_price` | INTEGER | Precio original (MSRP) |
| `compare_price` | INTEGER | Precio de comparación |
| `cost_price` | NUMERIC | Precio de costo |
| `stock` | INTEGER | Stock total (calculado automáticamente) |
| `sizes_available` | JSONB | Stock por talla: `{"36": 5, "42": 3}` |
| `category_id` | UUID (FK → categories) | Categoría |
| `brand_id` | UUID (FK → brands) | Marca |
| `brand` | VARCHAR | Nombre de marca (texto) |
| `model` | VARCHAR | Modelo |
| `sku` | VARCHAR (UNIQUE) | Código SKU |
| `is_featured` | BOOLEAN | Producto destacado |
| `is_active` | BOOLEAN | Activo en catálogo |
| `images` | TEXT[] | Array de URLs de imágenes |
| `tags` | TEXT[] | Etiquetas |

> **Nota sobre precios**: Todos los precios se almacenan en **céntimos** (ejemplo: 12999 = 129,99 €). Esto evita errores de redondeo con decimales.

#### `discount_codes`
Códigos de descuento configurables.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `code` | VARCHAR(50) (UNIQUE) | Código (ej: "VERANO20") |
| `discount_type` | VARCHAR(20) | `percentage` o `fixed` |
| `discount_value` | INTEGER | Valor (% o céntimos) |
| `min_purchase` | INTEGER | Compra mínima (céntimos) |
| `max_uses` | INTEGER | Usos máximos globales |
| `max_uses_per_user` | INTEGER | Usos por usuario |
| `current_uses` | INTEGER | Usos actuales |
| `is_active` | BOOLEAN | Activo |
| `starts_at` / `expires_at` | TIMESTAMPTZ | Período de validez |

#### `discount_code_uses`
Registro de uso de códigos de descuento.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `code_id` | UUID (FK → discount_codes) | Código utilizado |
| `user_id` | UUID (nullable) | Usuario (NULL = invitado) |
| `order_id` | UUID (FK → orders) | Pedido asociado |
| `discount_amount` | INTEGER | Descuento aplicado (céntimos) |

#### `orders`
Pedidos de compra. Soporta **guest checkout** (user_id = NULL).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `user_id` | UUID (nullable, FK → auth.users) | NULL = compra como invitado |
| `status` | VARCHAR | `pending` / `paid` / `shipped` / `delivered` / `cancelled` / `processing` |
| `total_amount` | INTEGER | Total en céntimos |
| `items` | JSONB | Array de items del pedido |
| `stripe_session_id` | TEXT (UNIQUE) | ID de sesión Stripe |
| `stripe_payment_intent_id` | TEXT | Payment Intent |
| `billing_email` | TEXT | Email de facturación |
| `shipping_name` | TEXT | Nombre de destinatario |
| `shipping_phone` | TEXT | Teléfono |
| `shipping_address` | JSONB | Dirección de envío |
| `cancelled_at` | TIMESTAMPTZ | Fecha de cancelación |
| `cancelled_reason` | TEXT | Motivo de cancelación |
| `shipped_at` | TIMESTAMPTZ | Fecha de envío |
| `delivered_at` | TIMESTAMPTZ | Fecha de entrega |

#### `newsletter_subscribers`
Suscriptores del boletín.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `email` | VARCHAR (UNIQUE) | Email |
| `verified` | BOOLEAN | Verificado |
| `subscribed_at` | TIMESTAMP | Fecha de suscripción |

#### `page_sections`
Secciones personalizables de la homepage.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `section_type` | TEXT | `hero`, `brands_bar`, `categories`, `featured_products`, `newsletter`, `flash_offers` |
| `title` / `subtitle` | TEXT | Títulos configurables |
| `content` | JSONB | Contenido dinámico |
| `display_order` | INTEGER | Orden de visualización |
| `is_visible` | BOOLEAN | Visible en la home |
| `settings` | JSONB | Configuración adicional |

#### `featured_product_selections`
Relación N:M entre secciones y productos destacados.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `section_id` | UUID (FK → page_sections, CASCADE) | Sección |
| `product_id` | UUID (FK → products, CASCADE) | Producto |
| `display_order` | INTEGER | Orden |

#### `invoices`
Registro de facturas con numeración secuencial.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `invoice_number` | TEXT (UNIQUE) | Número secuencial (F-2025-00001 / R-2025-00001) |
| `order_id` | UUID (FK → orders) | Pedido |
| `type` | TEXT | `standard` o `rectificativa` |
| `original_invoice_id` | UUID (FK → invoices) | Factura original (para rectificativas) |
| `amount` | INTEGER | Importe (céntimos) |
| `customer_email` | TEXT | Email del cliente |

### 11.3 Funciones RPC (PostgreSQL)

| Función | Descripción |
|---|---|
| `reduce_size_stock(p_id, p_size, p_qty)` | Reduce stock de una talla de forma atómica. Devuelve error si stock insuficiente |
| `add_size_stock(p_id, p_size, p_qty)` | Añade stock a una talla (para cancelaciones/devoluciones) |
| `cancel_order_atomic(order_id)` | Cancela pedido + restaura stock en una transacción |
| `validate_discount_code(code, user_id, subtotal)` | Valida código de descuento (existencia, vigencia, límites, mínimo de compra) |
| `request_return(order_id, user_id)` | Solicita devolución (solo en pedidos entregados) |
| `sync_stock_from_sizes()` | Trigger que sincroniza stock total desde `sizes_available` |
| `create_user_profile(id, email, name)` | Crea perfil con `SECURITY DEFINER` |
| `link_guest_orders_to_user(email, user_id)` | Vincula pedidos guest a una cuenta registrada |
| `generate_invoice_number(prefix)` | Genera número secuencial: F-YYYY-NNNNN o R-YYYY-NNNNN |

### 11.4 Diagrama de relaciones

```
auth.users ──┬── user_profiles (1:1)
             └── orders (1:N, nullable)

categories ──── products (1:N)
brands ──────── products (1:N)

products ────── featured_product_selections (N:M via page_sections)

orders ──────── invoices (1:N)
orders ──────── discount_code_uses (1:N)

discount_codes ── discount_code_uses (1:N)

page_sections ── featured_product_selections (1:N)

invoices ──────── invoices (auto-referencia: original → rectificativa)
```

---

## 12. Autenticación y Seguridad

### 12.1 Flujo de autenticación

1. **Login**: el usuario envía email + contraseña → Supabase Auth valida → se generan tokens JWT → se almacenan en cookies HttpOnly (`sb-access-token`, `sb-refresh-token`)
2. **Middleware**: en cada request, el middleware extrae los tokens de las cookies, los valida con Supabase y popula `Astro.locals.user`
3. **Protección admin**: para rutas `/admin` y `/api/admin`, el middleware verifica adicionalmente que `user_profiles.is_admin = true` consultando la BD con el service role client

### 12.2 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Políticas clave:

- **Productos, categorías, marcas, colores**: lectura pública, escritura solo admin (verificado via `user_profiles.is_admin`)
- **Pedidos**: los usuarios solo ven sus propios pedidos (`user_id = auth.uid()`)
- **Perfiles**: cada usuario solo puede ver/editar su propio perfil
- **Newsletter**: inserción pública, lectura/eliminación solo admin
- **Page sections**: lectura pública, escritura solo admin

### 12.3 Headers de seguridad

El middleware añade automáticamente:

| Header | Valor | Propósito |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Previene MIME type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Previene clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control de referrer |
| `Cache-Control` | `no-cache, no-store, must-revalidate` | No cachear páginas con sesión |

### 12.4 Protección CSRF

Las API routes usan validación de contenido (`Content-Type: application/json`) y tokens de sesión para proteger contra CSRF.

---

## 13. Pasarela de Pago (Stripe)

### 13.1 Flujo de compra

```
1. Cliente selecciona productos → Carrito (localStorage)
2. Click "Pagar" → POST /api/checkout/create-session
   ├── Validación de stock en servidor (409 si insuficiente)
   ├── Validación de código de descuento
   └── Creación de Stripe Checkout Session
3. Redirección a Stripe Checkout (página de pago)
4. Pago exitoso → Stripe envía webhook
5. POST /api/webhooks/stripe (checkout.session.completed)
   ├── Crear pedido en BD
   ├── Reducir stock atómicamente (RPC: reduce_size_stock)
   ├── Generar factura PDF con número secuencial
   ├── Registrar factura en tabla invoices
   ├── Enviar email de confirmación (con PDF adjunto)
   └── Registrar uso de descuento
6. Cliente redirigido a /checkout/success
```

### 13.2 Guest Checkout

Los usuarios pueden comprar **sin crear cuenta**. El email de Stripe se usa como `billing_email`. Los pedidos se pueden consultar desde `/pedidos` introduciendo el email.

Si el usuario se registra después, la función `link_guest_orders_to_user()` vincula los pedidos anteriores a su cuenta.

### 13.3 Cancelaciones y Reembolsos

- Los usuarios pueden cancelar pedidos en estado `paid`
- Al cancelar: se ejecuta reembolso via Stripe Refunds API, se restaura stock (RPC: `add_size_stock`), se genera factura rectificativa con importes negativos, y se envía email de confirmación
- Los administradores pueden cancelar desde el panel admin

---

## 14. Sistema de Facturación

### 14.1 Facturas estándar

- **Formato**: PDF generado con PDFKit
- **Numeración**: secuencial por año → `F-2025-00001`, `F-2025-00002`, etc.
- **Contenido**: logo, datos fiscales, dirección del cliente, tabla de items (nombre, talla, cantidad, precio unitario), base imponible, IVA 21%, total
- **Se genera automáticamente** al completar el pago (webhook de Stripe)
- **Se adjunta al email** de confirmación de pedido

### 14.2 Facturas rectificativas

- **Para**: cancelaciones y devoluciones
- **Numeración**: serie separada → `R-2025-00001`, `R-2025-00002`, etc.
- **Título**: "FACTURA RECTIFICATIVA"
- **Importes en negativo** (mostrados en color rojo)
- **Referencia**: enlaza con la factura original

### 14.3 Descarga

Los usuarios pueden descargar sus facturas desde la página de pedidos (`GET /api/orders/download-invoice`).

---

## 15. Sistema de Emails

### 15.1 Configuración

- **Transporte**: SMTP via Nodemailer
- **Proveedor por defecto**: Gmail (requiere contraseña de aplicación)
- **Templates**: HTML embebido con estilos inline

### 15.2 Tipos de email

| Email | Trigger | Contenido |
|---|---|---|
| **Confirmación de pedido** | Pago exitoso (webhook) | Resumen del pedido, items, total, factura PDF adjunta |
| **Cancelación de pedido** | Cancelación por usuario/admin | Motivo, confirmación de reembolso |
| **Solicitud de devolución** | Solicitud por usuario | Instrucciones de devolución |
| **Bienvenida newsletter** | Suscripción | Mensaje de bienvenida |
| **Notificación admin** | Nuevo pedido/cancelación | Alerta al administrador |

---

## 16. Gestión de Imágenes (Cloudinary)

### 16.1 Subida
- **Desde admin**: componente `CloudinaryImageUpload` con drag & drop
- **Destino**: CDN de Cloudinary (cloud name configurado por variable de entorno)

### 16.2 Optimización automática
- Formato WebP automático (`f_auto`)
- Calidad óptima (`q_auto`)
- Responsive: múltiples resoluciones generadas automáticamente
- Funciones de URL: galería, thumbnail, aspect ratio

---

## 17. SEO y Rendimiento

### 17.1 SEO

- **Sitemap dinámico** (`/sitemap.xml`): incluye todas las páginas, productos y categorías con fecha de actualización
- **Meta tags**: Open Graph, Twitter Cards en todas las páginas
- **URLs semánticas**: `/productos/nike-air-max-90`, `/categoria/running`
- **SSR**: todo el contenido renderizado en servidor (indexable por buscadores)
- **Canonical URLs**: configuradas en `BaseLayout.astro`

### 17.2 Rendimiento

- **Islands Architecture**: JavaScript mínimo, solo donde se necesita
- **Imágenes Cloudinary**: optimizadas automáticamente (WebP, responsive)
- **Tailwind CSS**: purge automático de clases no usadas en producción
- **Docker Alpine**: imagen de producción ligera

---

## 18. Variables de Entorno

### Variables públicas (accesibles en cliente)

| Variable | Descripción |
|---|---|
| `PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `PUBLIC_STRIPE_PUBLIC_KEY` | Clave pública de Stripe |
| `PUBLIC_CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary |
| `PUBLIC_ADMIN_EMAIL` | Email del administrador (bypass admin) |
| `PUBLIC_SITE_URL` | URL base del sitio |

### Variables secretas (solo servidor)

| Variable | Descripción |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio Supabase (bypassa RLS) |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret para verificar webhooks de Stripe |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `SMTP_HOST` | Host SMTP (default: `smtp.gmail.com`) |
| `SMTP_PORT` | Puerto SMTP (default: `587`) |
| `SMTP_USER` | Email SMTP (ej: tu cuenta de Gmail) |
| `SMTP_PASS` | Contraseña de aplicación SMTP |
| `FROM_EMAIL` | Email del remitente |
| `ADMIN_EMAIL` | Email del admin para notificaciones |
| `SITE_URL` | URL del sitio (para sitemap) |

> **Importante**: Las variables secretas **nunca** deben exponerse al cliente. En Astro, solo las variables con prefijo `PUBLIC_` son accesibles en el navegador.

---

## 19. Despliegue con Docker

### 19.1 Dockerfile (multi-stage)

```dockerfile
# Etapa 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Producción
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 4321
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4321/ || exit 1
CMD ["node", "./dist/server/entry.mjs"]
```

### 19.2 Pasos para desplegar

```bash
# 1. Construir imagen
docker build -t kickspremium .

# 2. Ejecutar contenedor (pasar variables de entorno)
docker run -d \
  --name kickspremium \
  -p 4321:4321 \
  --env-file .env \
  kickspremium

# 3. Verificar healthcheck
docker inspect --format='{{.State.Health.Status}}' kickspremium
```

### 19.3 Puerto de producción

La aplicación escucha en el puerto **4321** (configurado en Astro + Docker).

---

## 20. Comandos de Desarrollo

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Compilar para producción |
| `npm run preview` | Previsualizar build de producción |

---

## 21. Dependencias del Proyecto

### Producción

| Paquete | Versión | Propósito |
|---|---|---|
| `astro` | ^5.0.0 | Framework web (SSR) |
| `@astrojs/node` | ^9.5.1 | Adaptador Node.js standalone |
| `@astrojs/sitemap` | ^3.7.0 | Generación de sitemap |
| `react` / `react-dom` | ^18.2.0 | Componentes interactivos |
| `@supabase/supabase-js` | ^2.39.0 | Cliente de Supabase |
| `stripe` | ^20.1.2 | SDK de Stripe (server) |
| `@stripe/stripe-js` | ^8.6.1 | SDK de Stripe (client) |
| `cloudinary` | ^2.8.0 | SDK de Cloudinary |
| `nodemailer` | ^6.10.1 | Envío de emails SMTP |
| `pdfkit` | ^0.17.2 | Generación de PDFs |
| `pdf-lib` | ^1.17.1 | Manipulación de PDFs |
| `nanostores` | ^0.10.2 | Estado global react |
| `tailwindcss` | ^3.3.0 | Framework CSS |
| `autoprefixer` | ^10.4.0 | CSS vendor prefixes |
| `postcss` | ^8.4.0 | Procesador CSS |

### Desarrollo

| Paquete | Versión | Propósito |
|---|---|---|
| `@astrojs/react` | ^3.0.0 | Integración React para Astro |
| `@astrojs/tailwind` | ^5.0.0 | Integración Tailwind para Astro |
| `typescript` | ^5.9.3 | Tipado estático |
| `@types/nodemailer` | ^7.0.5 | Tipos de Nodemailer |
| `@types/pdfkit` | ^0.17.4 | Tipos de PDFKit |
| `@astrojs/check` | ^0.9.6 | Verificación de tipos Astro |

---

## Anexo A: Paleta de colores (Tailwind)

| Nombre | Valor | Uso |
|---|---|---|
| `brand-black` | `#0a0a0a` | Color principal, fondos oscuros |
| `brand-white` | `#fafafa` | Texto sobre fondos oscuros |
| `brand-red` | `#dc2626` | Acentos, precios con descuento, alertas |
| `brand-orange` | `#f97316` | Botones "Añadir al carrito" |
| `brand-cream` | `#f5f5f0` | Fondos claros |
| `brand-gray` | `#6b7280` | Texto secundario |
| `brand-gold` | `#d4a853` | Elementos premium, edición limitada |

---

## Anexo B: Configuración de Stripe (Webhook)

Para que el sistema funcione correctamente, es necesario configurar un webhook en el dashboard de Stripe:

1. Ir a **Stripe Dashboard → Developers → Webhooks**
2. Crear endpoint: `https://kickspremium.victoriafp.online/api/webhooks/stripe`
3. Seleccionar evento: `checkout.session.completed`
4. Copiar el **Webhook Secret** y configurarlo como `STRIPE_WEBHOOK_SECRET`

---

## Anexo C: Configuración de Supabase

### Tablas necesarias
Ejecutar el script `DATABASE_OPTIMIZED.sql` en el SQL Editor de Supabase para crear:
- 12 tablas con todas las columnas, constraints y relaciones
- Políticas RLS para cada tabla
- Funciones RPC (stock, facturas, descuentos, etc.)
- Triggers automáticos

### Auth
- La autenticación se maneja con Supabase Auth
- Al registrar un usuario, se crea automáticamente un perfil en `user_profiles`
- El primer admin se configura estableciendo `is_admin = true` directamente en la BD o usando la variable `PUBLIC_ADMIN_EMAIL`

---

*Documento generado para el proyecto KicksPremium. Toda la información es confidencial y propiedad del cliente.*
