-- ============================================================================
-- KICKSPREMIUM - BASE DE DATOS COMPLETA Y ACTUALIZADA - SUPABASE
-- ============================================================================
-- Tienda de Sneakers Exclusivos y Ediciones Limitadas
-- Última actualización: 13 de febrero de 2026
-- 
-- ESTE ARCHIVO CONTIENE TODA LA CONFIGURACIÓN COMPLETA DE LA BASE DE DATOS:
-- ✅ Tablas de administración (usuarios, perfiles)
-- ✅ Tablas de productos (categorías, productos, marcas, colores)
-- ✅ Tablas de carrito y favoritos
-- ✅ Tablas de pedidos (orders, order_items)
-- ✅ Tablas de reviews y alertas de restock
-- ✅ Tablas de newsletter (suscriptores)
-- ✅ Tablas de descuentos (códigos, tracking)
-- ✅ Tablas VIP (suscripciones, notificaciones)
-- ✅ Tablas de personalización (page_sections, featured_products)
-- ✅ Todas las políticas RLS (Row Level Security)
-- ✅ Todos los índices para optimización
-- ✅ Todos los triggers y funciones
--
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard > SQL Editor > New Query
-- 2. Copiar este archivo completo
-- 3. Ejecutar TODO (recomendado hacerlo en bloques/secciones)
-- 4. Verificar que no haya errores al final
--
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: TABLAS DE ADMINISTRACIÓN
-- ============================================================================

-- TABLA: user_profiles (Perfiles de Usuarios y Admin)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin);

-- ============================================================================
-- SECCIÓN 2: TABLAS DE PRODUCTOS Y CATEGORÍAS
-- ============================================================================

-- TABLA: brands (Marcas de Sneakers)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name CHARACTER VARYING NOT NULL UNIQUE,
  slug CHARACTER VARYING NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Índices para brands
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_display_order ON brands(display_order);

-- TABLA: categories (Categorías de Productos)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name CHARACTER VARYING NOT NULL,
  slug CHARACTER VARYING NOT NULL UNIQUE,
  description TEXT,
  icon CHARACTER VARYING,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para categories
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- TABLA: colors (Colores disponibles)
CREATE TABLE IF NOT EXISTS public.colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name CHARACTER VARYING NOT NULL,
  slug CHARACTER VARYING NOT NULL UNIQUE,
  hex_code CHARACTER VARYING NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Índice para colors
CREATE INDEX IF NOT EXISTS idx_colors_slug ON colors(slug);

-- TABLA: products (Productos/Zapatillas)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Información básica
  name CHARACTER VARYING NOT NULL,
  slug CHARACTER VARYING NOT NULL UNIQUE,
  description TEXT,
  detailed_description JSONB,
  
  -- Precios (en céntimos EUR)
  price INTEGER NOT NULL CHECK (price >= 0),
  original_price INTEGER,
  compare_price INTEGER,
  cost_price NUMERIC DEFAULT NULL,
  
  -- Inventario
  stock INTEGER NOT NULL DEFAULT 0,
  sizes_available JSONB,
  
  -- Categorización
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Datos específicos de sneakers
  brand CHARACTER VARYING,
  model CHARACTER VARYING,
  colorway CHARACTER VARYING,
  sku CHARACTER VARYING NOT NULL UNIQUE,
  release_date DATE,
  material CHARACTER VARYING,
  color CHARACTER VARYING,
  
  -- Flags
  is_limited_edition BOOLEAN DEFAULT FALSE,
  release_type CHARACTER VARYING DEFAULT 'standard',
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Imágenes y tags
  images TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);

-- TABLA: product_colors (Relación productos-colores)
CREATE TABLE IF NOT EXISTS public.product_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE
);

-- Índices para product_colors
CREATE INDEX IF NOT EXISTS idx_product_colors_product ON product_colors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_color ON product_colors(color_id);

-- ============================================================================
-- SECCIÓN 3: TABLAS DE CARRITO Y FAVORITOS
-- ============================================================================

-- TABLA: cart_items (Items del carrito)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size CHARACTER VARYING NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para cart_items
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- TABLA: favorites (Favoritos de usuarios)
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Índices para favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);

-- ============================================================================
-- SECCIÓN 4: TABLAS DE DESCUENTOS
-- ============================================================================

-- TABLA: discount_codes (Códigos de Descuento)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code CHARACTER VARYING(50) NOT NULL UNIQUE,
  description TEXT,
  
  -- Tipo de descuento
  discount_type CHARACTER VARYING(20) NOT NULL DEFAULT 'percentage', -- 'percentage' o 'fixed'
  discount_value INTEGER NOT NULL, -- En porcentaje (10 = 10%) o céntimos (1000 = 10€)
  
  -- Restricciones
  min_purchase INTEGER DEFAULT 0, -- Compra mínima en céntimos
  max_uses INTEGER DEFAULT NULL, -- NULL = ilimitado
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  
  -- Validez
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para discount_codes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- ============================================================================
-- SECCIÓN 5: TABLAS DE PEDIDOS
-- ============================================================================

-- TABLA: orders (Pedidos)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Estado
  status CHARACTER VARYING DEFAULT 'pending',
  
  -- Montos (en céntimos EUR)
  total_price INTEGER NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  subtotal_amount INTEGER,
  discount_amount INTEGER DEFAULT 0,
  
  -- Items del pedido (JSONB array)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Información de Stripe
  stripe_payment_id CHARACTER VARYING UNIQUE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Información de envío
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_address JSONB,
  billing_email TEXT,
  notes TEXT,
  
  -- Descuentos
  discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL,
  
  -- Estados y timestamps
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_reason TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  return_requested_at TIMESTAMP WITH TIME ZONE,
  return_status CHARACTER VARYING(50),
  
  -- Timestamps
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_id ON orders(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);

-- TABLA: order_items (Items de Pedidos - detalle normalizado)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  size CHARACTER VARYING NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase INTEGER NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Índices para order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- TABLA: discount_code_uses (Tracking de uso de códigos)
CREATE TABLE IF NOT EXISTS public.discount_code_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount INTEGER NOT NULL, -- Descuento aplicado en céntimos
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para discount_code_uses
CREATE INDEX IF NOT EXISTS idx_code_uses_code ON discount_code_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_code_uses_user ON discount_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_code_uses_order ON discount_code_uses(order_id);

-- ============================================================================
-- SECCIÓN 6: TABLAS DE REVIEWS Y ALERTAS
-- ============================================================================

-- TABLA: product_reviews (Reviews de Productos)
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para product_reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON product_reviews(rating);

-- TABLA: restock_alerts (Alertas de Restock)
CREATE TABLE IF NOT EXISTS public.restock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size CHARACTER VARYING NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  notified_at TIMESTAMP WITHOUT TIME ZONE,
  UNIQUE(user_id, product_id, size)
);

-- Índices para restock_alerts
CREATE INDEX IF NOT EXISTS idx_restock_user ON restock_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_restock_product ON restock_alerts(product_id);

-- ============================================================================
-- SECCIÓN 7: TABLA DE NEWSLETTER
-- ============================================================================

-- TABLA: newsletter_subscribers (Suscriptores Newsletter)
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email CHARACTER VARYING NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  subscribed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para newsletter_subscribers
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_verified ON newsletter_subscribers(verified);
CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter_subscribers(subscribed_at DESC);

-- ============================================================================
-- SECCIÓN 8: SISTEMA VIP ACCESS
-- ============================================================================

-- TABLA: vip_subscriptions (Suscripciones VIP)
CREATE TABLE IF NOT EXISTS public.vip_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, cancelled, past_due, expired
  plan_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual
  price_cents INTEGER NOT NULL DEFAULT 999, -- 9.99€/mes por defecto
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para vip_subscriptions
CREATE INDEX IF NOT EXISTS idx_vip_user_id ON vip_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_email ON vip_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_vip_status ON vip_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_vip_stripe_sub ON vip_subscriptions(stripe_subscription_id);

-- TABLA: vip_notifications (Notificaciones para VIPs)
CREATE TABLE IF NOT EXISTS public.vip_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'new_product', 'restock', 'vip_discount'
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para vip_notifications
CREATE INDEX IF NOT EXISTS idx_vip_notif_type ON vip_notifications(type);
CREATE INDEX IF NOT EXISTS idx_vip_notif_created ON vip_notifications(created_at DESC);

-- TABLA: vip_notification_reads (Qué notificaciones ha leído cada VIP)
CREATE TABLE IF NOT EXISTS public.vip_notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID REFERENCES vip_notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Índices para vip_notification_reads
CREATE INDEX IF NOT EXISTS idx_vip_reads_notification ON vip_notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_vip_reads_user ON vip_notification_reads(user_id);

-- ============================================================================
-- SECCIÓN 9: PAGE CUSTOMIZER (Personalización de página)
-- ============================================================================

-- TABLA: page_sections (Secciones de la página principal)
CREATE TABLE IF NOT EXISTS public.page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_type TEXT NOT NULL, -- 'hero', 'featured_products', 'categories', 'banner', 'brands', 'newsletter', 'custom_products'
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}', -- Contenido flexible según tipo
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}', -- Estilos, colores, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para page_sections
CREATE INDEX IF NOT EXISTS idx_page_sections_order ON page_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_page_sections_visible ON page_sections(is_visible);
CREATE INDEX IF NOT EXISTS idx_page_sections_type ON page_sections(section_type);

-- TABLA: featured_product_selections (Productos seleccionados para secciones)
CREATE TABLE IF NOT EXISTS public.featured_product_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES page_sections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(section_id, product_id)
);

-- Índices para featured_product_selections
CREATE INDEX IF NOT EXISTS idx_featured_section ON featured_product_selections(section_id);
CREATE INDEX IF NOT EXISTS idx_featured_product ON featured_product_selections(product_id);

-- ============================================================================
-- SECCIÓN 10: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_product_selections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS: user_profiles
-- ============================================================================

DROP POLICY IF EXISTS "Usuarios autenticados pueden leer sus datos" ON public.user_profiles;
CREATE POLICY "Usuarios autenticados pueden leer sus datos" ON public.user_profiles
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON public.user_profiles;
CREATE POLICY "Usuarios pueden insertar su propio perfil" ON public.user_profiles
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile" ON public.user_profiles
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id) OR (current_setting('role', true) = 'service_role'));

DROP POLICY IF EXISTS "Usuarios pueden actualizar su perfil" ON public.user_profiles;
CREATE POLICY "Usuarios pueden actualizar su perfil" ON public.user_profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins pueden actualizar cualquier perfil" ON public.user_profiles;
CREATE POLICY "Admins pueden actualizar cualquier perfil" ON public.user_profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.is_admin = true
  ));

DROP POLICY IF EXISTS "service_role_all_profiles" ON public.user_profiles;
CREATE POLICY "service_role_all_profiles" ON public.user_profiles
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ============================================================================
-- POLÍTICAS RLS: brands
-- ============================================================================

DROP POLICY IF EXISTS "Brands readable by all" ON public.brands;
CREATE POLICY "Brands readable by all" ON public.brands
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "brands_public_read" ON public.brands;
CREATE POLICY "brands_public_read" ON public.brands
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "admins_manage_brands" ON public.brands;
CREATE POLICY "admins_manage_brands" ON public.brands
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true
  ));

-- ============================================================================
-- POLÍTICAS RLS: categories
-- ============================================================================

DROP POLICY IF EXISTS "Categories readable by all" ON public.categories;
CREATE POLICY "Categories readable by all" ON public.categories
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone" ON public.categories
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- ============================================================================
-- POLÍTICAS RLS: colors
-- ============================================================================

DROP POLICY IF EXISTS "Colors readable by all" ON public.colors;
CREATE POLICY "Colors readable by all" ON public.colors
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "colors_public_read" ON public.colors;
CREATE POLICY "colors_public_read" ON public.colors
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- ============================================================================
-- POLÍTICAS RLS: products
-- ============================================================================

DROP POLICY IF EXISTS "Products are readable by everyone" ON public.products;
CREATE POLICY "Products are readable by everyone" ON public.products
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone" ON public.products
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "public_read_active_products" ON public.products;
CREATE POLICY "public_read_active_products" ON public.products
  AS PERMISSIVE FOR SELECT TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "authenticated_manage_products" ON public.products;
CREATE POLICY "authenticated_manage_products" ON public.products
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- POLÍTICAS RLS: product_colors
-- ============================================================================

DROP POLICY IF EXISTS "Product colors readable by all" ON public.product_colors;
CREATE POLICY "Product colors readable by all" ON public.product_colors
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- ============================================================================
-- POLÍTICAS RLS: cart_items
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own cart" ON public.cart_items;
CREATE POLICY "Users can manage own cart" ON public.cart_items
  AS PERMISSIVE FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- POLÍTICAS RLS: favorites
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites" ON public.favorites
  AS PERMISSIVE FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Favorites readable by all" ON public.favorites;
CREATE POLICY "Favorites readable by all" ON public.favorites
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- ============================================================================
-- POLÍTICAS RLS: discount_codes
-- ============================================================================

DROP POLICY IF EXISTS "anyone_can_validate_codes" ON public.discount_codes;
CREATE POLICY "anyone_can_validate_codes" ON public.discount_codes
  AS PERMISSIVE FOR SELECT TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "admins_manage_codes" ON public.discount_codes;
CREATE POLICY "admins_manage_codes" ON public.discount_codes
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.is_admin = true
  ));

-- ============================================================================
-- POLÍTICAS RLS: discount_code_uses
-- ============================================================================

DROP POLICY IF EXISTS "users_see_own_uses" ON public.discount_code_uses;
CREATE POLICY "users_see_own_uses" ON public.discount_code_uses
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_insert_uses" ON public.discount_code_uses;
CREATE POLICY "service_insert_uses" ON public.discount_code_uses
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: orders
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
CREATE POLICY "Users can create orders" ON public.orders
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders" ON public.orders
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
CREATE POLICY "Users can update own orders" ON public.orders
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON public.orders;
CREATE POLICY "Service role full access" ON public.orders
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: order_items
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  ));

-- ============================================================================
-- POLÍTICAS RLS: product_reviews
-- ============================================================================

DROP POLICY IF EXISTS "Reviews readable by all" ON public.product_reviews;
CREATE POLICY "Reviews readable by all" ON public.product_reviews
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Users can create own reviews" ON public.product_reviews;
CREATE POLICY "Users can create own reviews" ON public.product_reviews
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- POLÍTICAS RLS: restock_alerts
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own alerts" ON public.restock_alerts;
CREATE POLICY "Users can manage own alerts" ON public.restock_alerts
  AS PERMISSIVE FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- POLÍTICAS RLS: newsletter_subscribers
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone_can_subscribe" ON public.newsletter_subscribers;
CREATE POLICY "anyone_can_subscribe" ON public.newsletter_subscribers
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can unsubscribe from newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can unsubscribe from newsletter" ON public.newsletter_subscribers
  AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS "anyone_can_select" ON public.newsletter_subscribers;
CREATE POLICY "anyone_can_select" ON public.newsletter_subscribers
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Service role full access newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Service role full access newsletter" ON public.newsletter_subscribers
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_newsletter" ON public.newsletter_subscribers;
CREATE POLICY "service_role_all_newsletter" ON public.newsletter_subscribers
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: vip_subscriptions
-- ============================================================================

DROP POLICY IF EXISTS "users_see_own_vip" ON public.vip_subscriptions;
CREATE POLICY "users_see_own_vip" ON public.vip_subscriptions
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_manage_vip" ON public.vip_subscriptions;
CREATE POLICY "service_manage_vip" ON public.vip_subscriptions
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: vip_notifications
-- ============================================================================

DROP POLICY IF EXISTS "service_manage_vip_notif" ON public.vip_notifications;
CREATE POLICY "service_manage_vip_notif" ON public.vip_notifications
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: vip_notification_reads
-- ============================================================================

DROP POLICY IF EXISTS "users_own_reads" ON public.vip_notification_reads;
CREATE POLICY "users_own_reads" ON public.vip_notification_reads
  AS PERMISSIVE FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_manage_reads" ON public.vip_notification_reads;
CREATE POLICY "service_manage_reads" ON public.vip_notification_reads
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: page_sections
-- ============================================================================

DROP POLICY IF EXISTS "public_read_sections" ON public.page_sections;
CREATE POLICY "public_read_sections" ON public.page_sections
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "admins_manage_sections" ON public.page_sections;
CREATE POLICY "admins_manage_sections" ON public.page_sections
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.is_admin = true
  ));

DROP POLICY IF EXISTS "service_manage_sections" ON public.page_sections;
CREATE POLICY "service_manage_sections" ON public.page_sections
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: featured_product_selections
-- ============================================================================

DROP POLICY IF EXISTS "public_read_featured" ON public.featured_product_selections;
CREATE POLICY "public_read_featured" ON public.featured_product_selections
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "admins_manage_featured" ON public.featured_product_selections;
CREATE POLICY "admins_manage_featured" ON public.featured_product_selections
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.is_admin = true
  ));

DROP POLICY IF EXISTS "service_manage_featured" ON public.featured_product_selections;
CREATE POLICY "service_manage_featured" ON public.featured_product_selections
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SECCIÓN 11: TRIGGERS Y FUNCIONES
-- ============================================================================

-- FUNCIÓN: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para user_profiles
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para categories
DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para products
DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para cart_items
DROP TRIGGER IF EXISTS trigger_cart_items_updated_at ON cart_items;
CREATE TRIGGER trigger_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para orders
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para product_reviews
DROP TRIGGER IF EXISTS trigger_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER trigger_product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para newsletter_subscribers
DROP TRIGGER IF EXISTS trigger_newsletter_updated_at ON newsletter_subscribers;
CREATE TRIGGER trigger_newsletter_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para discount_codes
DROP TRIGGER IF EXISTS trigger_discount_codes_updated_at ON discount_codes;
CREATE TRIGGER trigger_discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para vip_subscriptions
DROP TRIGGER IF EXISTS trigger_vip_subscriptions_updated_at ON vip_subscriptions;
CREATE TRIGGER trigger_vip_subscriptions_updated_at
  BEFORE UPDATE ON vip_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para page_sections
DROP TRIGGER IF EXISTS trigger_page_sections_updated_at ON page_sections;
CREATE TRIGGER trigger_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECCIÓN 12: FUNCIONES DE GESTIÓN DE STOCK
-- ============================================================================

-- FUNCIÓN: Calcular stock total desde tallas
CREATE OR REPLACE FUNCTION calculate_total_stock_from_sizes(sizes_json JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  total INTEGER := 0;
  size_key TEXT;
  size_qty INTEGER;
BEGIN
  IF sizes_json IS NULL OR sizes_json = '{}'::jsonb THEN
    RETURN 0;
  END IF;
  
  FOR size_key IN SELECT jsonb_object_keys(sizes_json)
  LOOP
    size_qty := COALESCE((sizes_json->>size_key)::INTEGER, 0);
    IF size_qty > 0 THEN
      total := total + size_qty;
    END IF;
  END LOOP;
  
  RETURN total;
END;
$$;

-- FUNCIÓN: Sincronizar stock desde tallas (trigger)
CREATE OR REPLACE FUNCTION sync_stock_from_sizes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_stock INTEGER;
BEGIN
  -- Calcular el stock total desde las tallas
  calculated_stock := calculate_total_stock_from_sizes(NEW.sizes_available);
  
  -- Actualizar el stock principal
  NEW.stock := calculated_stock;
  
  RETURN NEW;
END;
$$;

-- Trigger que sincroniza stock
DROP TRIGGER IF EXISTS trigger_sync_stock ON products;
CREATE TRIGGER trigger_sync_stock
  BEFORE INSERT OR UPDATE OF sizes_available
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_stock_from_sizes();

-- FUNCIÓN: Obtener tallas disponibles (con stock > 0)
CREATE OR REPLACE FUNCTION get_available_sizes(sizes_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  size_key TEXT;
  size_qty INTEGER;
BEGIN
  IF sizes_json IS NULL OR sizes_json = '{}'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;
  
  FOR size_key IN SELECT jsonb_object_keys(sizes_json)
  LOOP
    size_qty := COALESCE((sizes_json->>size_key)::INTEGER, 0);
    IF size_qty > 0 THEN
      result := result || jsonb_build_object(size_key, size_qty);
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;

-- FUNCIÓN: Reducir stock de una talla específica
CREATE OR REPLACE FUNCTION reduce_size_stock(
  p_product_id UUID,
  p_size TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_sizes JSONB;
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_new_sizes JSONB;
BEGIN
  -- Obtener tallas actuales
  SELECT sizes_available INTO v_current_sizes
  FROM products WHERE id = p_product_id;
  
  IF v_current_sizes IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado');
  END IF;
  
  -- Obtener cantidad actual de la talla
  v_current_qty := COALESCE((v_current_sizes->>p_size)::INTEGER, 0);
  
  IF v_current_qty < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Stock insuficiente para talla ' || p_size,
      'available', v_current_qty,
      'requested', p_quantity
    );
  END IF;
  
  -- Calcular nueva cantidad
  v_new_qty := v_current_qty - p_quantity;
  
  -- Actualizar sizes_available
  IF v_new_qty <= 0 THEN
    v_new_sizes := v_current_sizes - p_size;
  ELSE
    v_new_sizes := jsonb_set(v_current_sizes, ARRAY[p_size], to_jsonb(v_new_qty));
  END IF;
  
  UPDATE products
  SET sizes_available = v_new_sizes,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'size', p_size,
    'previous_qty', v_current_qty,
    'new_qty', v_new_qty,
    'sizes_available', v_new_sizes
  );
END;
$$;

-- FUNCIÓN: Añadir stock a una talla
CREATE OR REPLACE FUNCTION add_size_stock(
  p_product_id UUID,
  p_size TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_sizes JSONB;
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_new_sizes JSONB;
BEGIN
  SELECT sizes_available INTO v_current_sizes
  FROM products WHERE id = p_product_id;
  
  IF v_current_sizes IS NULL THEN
    v_current_sizes := '{}'::jsonb;
  END IF;
  
  v_current_qty := COALESCE((v_current_sizes->>p_size)::INTEGER, 0);
  v_new_qty := v_current_qty + p_quantity;
  v_new_sizes := jsonb_set(v_current_sizes, ARRAY[p_size], to_jsonb(v_new_qty), true);
  
  UPDATE products
  SET sizes_available = v_new_sizes,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'size', p_size,
    'previous_qty', v_current_qty,
    'new_qty', v_new_qty,
    'sizes_available', v_new_sizes
  );
END;
$$;

-- ============================================================================
-- SECCIÓN 13: FUNCIONES DE GESTIÓN DE PEDIDOS
-- ============================================================================

-- FUNCIÓN: Cancelar pedido (transacción atómica)
CREATE OR REPLACE FUNCTION cancel_order_atomic(
  p_order_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Cancelado por el cliente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_size TEXT;
  v_current_sizes JSONB;
  v_current_stock INTEGER;
BEGIN
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  IF v_order.status NOT IN ('pending', 'paid', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido no se puede cancelar. Estado actual: ' || v_order.status);
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 1);
    v_size := v_item->>'size';
    
    IF v_product_id IS NOT NULL THEN
      SELECT stock, sizes_available INTO v_current_stock, v_current_sizes
      FROM products WHERE id = v_product_id;
      
      UPDATE products
      SET stock = stock + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;
      
      IF v_size IS NOT NULL AND v_current_sizes IS NOT NULL THEN
        UPDATE products
        SET sizes_available = jsonb_set(
          COALESCE(sizes_available, '{}'::jsonb),
          ARRAY[v_size],
          to_jsonb(COALESCE((sizes_available->>v_size)::INTEGER, 0) + v_quantity)
        ),
        updated_at = NOW()
        WHERE id = v_product_id;
      END IF;
    END IF;
  END LOOP;
  
  UPDATE orders
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pedido cancelado correctamente',
    'order_id', p_order_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- FUNCIÓN: Validar y aplicar código de descuento
CREATE OR REPLACE FUNCTION validate_discount_code(
  p_code VARCHAR,
  p_user_id UUID,
  p_cart_total INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_discount RECORD;
  v_user_uses INTEGER;
  v_discount_amount INTEGER;
  v_user_orders INTEGER;
BEGIN
  SELECT * INTO v_discount
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código no válido o expirado');
  END IF;
  
  IF v_discount.code IN ('WELCOME10', 'PRIMERA_COMPRA') AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_orders
    FROM orders
    WHERE user_id = p_user_id AND status IN ('completed', 'pending', 'processing', 'shipped');
    
    IF v_user_orders > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Este código solo es válido para tu primera compra');
    END IF;
  END IF;
  
  IF v_discount.max_uses IS NOT NULL AND v_discount.current_uses >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;
  
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
    FROM discount_code_uses
    WHERE code_id = v_discount.id AND user_id = p_user_id;
    
    IF v_user_uses >= v_discount.max_uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Ya has usado este código');
    END IF;
  END IF;
  
  IF p_cart_total < v_discount.min_purchase THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Compra mínima requerida: €' || (v_discount.min_purchase / 100.0)::TEXT
    );
  END IF;
  
  IF v_discount.discount_type = 'percentage' THEN
    v_discount_amount := (p_cart_total * v_discount.discount_value / 100);
  ELSE
    v_discount_amount := v_discount.discount_value;
  END IF;
  
  IF v_discount_amount > p_cart_total THEN
    v_discount_amount := p_cart_total;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'code_id', v_discount.id,
    'code', v_discount.code,
    'discount_type', v_discount.discount_type,
    'discount_value', v_discount.discount_value,
    'discount_amount', v_discount_amount,
    'description', v_discount.description
  );
END;
$$;

-- FUNCIÓN: Solicitar devolución
CREATE OR REPLACE FUNCTION request_return(
  p_order_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Solicitud de devolución del cliente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  IF v_order.status != 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo puedes solicitar devolución de pedidos entregados');
  END IF;
  
  IF v_order.return_requested_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido ya tiene una solicitud de devolución');
  END IF;
  
  UPDATE orders
  SET return_requested_at = NOW(),
      return_status = 'requested',
      updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitud de devolución creada',
    'order_id', p_order_id,
    'return_status', 'requested'
  );
END;
$$;

-- FUNCIÓN: Crear perfil de usuario (SECURITY DEFINER para bypass RLS)
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, is_admin)
  VALUES (p_user_id, p_email, p_full_name, p_is_admin)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, user_profiles.full_name),
    is_admin = COALESCE(p_is_admin, user_profiles.is_admin);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECCIÓN 14: DATOS INICIALES
-- ============================================================================

-- Insertar marcas principales
INSERT INTO brands (name, slug, is_featured, display_order) VALUES
('Nike', 'nike', true, 1),
('Jordan', 'jordan', true, 2),
('Adidas', 'adidas', true, 3),
('Yeezy', 'yeezy', true, 4),
('New Balance', 'new-balance', true, 5),
('Puma', 'puma', true, 6),
('Reebok', 'reebok', false, 7),
('Converse', 'converse', false, 8),
('Vans', 'vans', false, 9),
('ASICS', 'asics', false, 10)
ON CONFLICT (slug) DO UPDATE SET
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order;

-- Insertar categorías
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
('Exclusive Drops', 'limited-editions', 'Lanzamientos exclusivos, one-of-a-kind y piezas ultra raras', '💎', 1),
('Retro Classics', 'retro-classics', 'Reediciones de modelos icónicos de los 80s y 90s', '👟', 2),
('High Tops', 'high-tops', 'Sneakers de caña alta para un look urbano', '🔝', 3),
('Low Tops', 'low-tops', 'Sneakers de caña baja, versatilidad máxima', '⬇️', 4),
('Collabs', 'collabs', 'Colaboraciones con artistas, diseñadores y marcas', '🤝', 5),
('Performance', 'performance', 'Sneakers diseñados para rendimiento deportivo', '🏃', 6),
('Lifestyle', 'lifestyle', 'Sneakers casuales para el día a día', '🌆', 7),
('Travis Scott', 'travis-scott', 'Colaboraciones exclusivas de Travis Scott con Jordan y Nike', 'TS', 8),
('Jordan Special', 'jordan-special', 'Air Jordans de ediciones especiales y limitadas', 'JS', 9),
('Adidas Collab', 'adidas-collab', 'Colaboraciones exclusivas de Adidas con artistas reconocidos', 'AC', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

-- Insertar colores principales
INSERT INTO colors (name, slug, hex_code, display_order) VALUES
('Negro', 'negro', '#000000', 1),
('Blanco', 'blanco', '#FFFFFF', 2),
('Rojo', 'rojo', '#FF0000', 3),
('Azul', 'azul', '#0066FF', 4),
('Verde', 'verde', '#00CC00', 5),
('Amarillo', 'amarillo', '#FFCC00', 6),
('Naranja', 'naranja', '#FF6600', 7),
('Rosa', 'rosa', '#FF69B4', 8),
('Morado', 'morado', '#9933FF', 9),
('Marrón', 'marron', '#8B4513', 10),
('Gris', 'gris', '#808080', 11),
('Beige', 'beige', '#F5F5DC', 12),
('Multi', 'multi', '#999999', 13)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  hex_code = EXCLUDED.hex_code,
  display_order = EXCLUDED.display_order;

-- Insertar códigos de descuento iniciales
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user)
VALUES ('WELCOME10', 'Descuento de bienvenida - 10% en tu primera compra', 'percentage', 10, 5000, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase)
VALUES ('FREESHIP', 'Envío gratis en pedidos superiores a 100€', 'fixed', 599, 10000)
ON CONFLICT (code) DO NOTHING;

INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses)
VALUES ('VIP20', 'Descuento VIP - 20% en toda la tienda', 'percentage', 20, 0, 100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user, max_uses)
VALUES ('VIP15', 'Descuento exclusivo para miembros VIP - 15%', 'percentage', 15, 0, 999, NULL)
ON CONFLICT (code) DO NOTHING;

-- Secciones iniciales de la página
INSERT INTO page_sections (section_type, title, subtitle, display_order, is_visible, content, settings) VALUES
('hero', 'SNEAKERS EXCLUSIVOS & LIMITADOS', 'Colaboraciones especiales, ediciones limitadas y piezas únicas. Travis Scott • Jordan Special • Adidas Collab • Nike Rare', 1, true, 
  '{"cta_primary": {"text": "Explorar Colección", "url": "/productos"}, "cta_secondary": {"text": "Ediciones Limitadas", "url": "/categoria/limited-editions"}, "badge": "Exclusively Limited"}'::jsonb,
  '{"bg_color": "brand-black", "text_color": "white"}'::jsonb),
('brands_bar', 'Marcas', null, 2, true,
  '{"brands": ["Travis Scott", "Jordan Special", "Adidas Collab", "Nike Rare", "Yeezy SZN"]}'::jsonb,
  '{}'::jsonb),
('categories', 'Colecciones', 'Piezas exclusivas y únicamente disponibles', 3, true,
  '{}'::jsonb,
  '{"columns": 4}'::jsonb),
('featured_products', 'Destacados', 'Hot Right Now', 4, true,
  '{"max_products": 6}'::jsonb,
  '{"columns": 3}'::jsonb),
('newsletter', 'No te pierdas ningún drop', 'Únete a nuestra lista y sé el primero en enterarte de los nuevos lanzamientos y ofertas exclusivas.', 5, true,
  '{}'::jsonb,
  '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECCIÓN 15: VERIFICACIÓN FINAL
-- ============================================================================

SELECT '✅ Base de datos COMPLETA y ACTUALIZADA creada correctamente' as resultado;

-- Listar tablas creadas
SELECT 
  'Tablas creadas: ' || COUNT(*)::TEXT as info
FROM pg_tables 
WHERE schemaname = 'public';

-- ============================================================================
-- NOTAS FINALES
-- ============================================================================
-- 
-- TABLAS INCLUIDAS (20 tablas):
-- 1.  user_profiles - Perfiles de usuarios y administradores
-- 2.  brands - Marcas de sneakers
-- 3.  categories - Categorías de productos
-- 4.  colors - Colores disponibles
-- 5.  products - Productos/Zapatillas
-- 6.  product_colors - Relación productos-colores
-- 7.  cart_items - Items del carrito de compra
-- 8.  favorites - Favoritos de usuarios
-- 9.  discount_codes - Códigos de descuento
-- 10. discount_code_uses - Tracking de uso de códigos
-- 11. orders - Pedidos
-- 12. order_items - Items de pedidos (detalle)
-- 13. product_reviews - Reviews de productos
-- 14. restock_alerts - Alertas de restock
-- 15. newsletter_subscribers - Suscriptores newsletter
-- 16. vip_subscriptions - Suscripciones VIP
-- 17. vip_notifications - Notificaciones VIP
-- 18. vip_notification_reads - Lecturas de notificaciones VIP
-- 19. page_sections - Secciones de página personalizables
-- 20. featured_product_selections - Productos destacados por sección
--
-- FUNCIONES INCLUIDAS:
-- - update_updated_at_column() - Trigger genérico para updated_at
-- - calculate_total_stock_from_sizes() - Calcula stock total desde tallas
-- - sync_stock_from_sizes() - Sincroniza stock automáticamente
-- - get_available_sizes() - Obtiene tallas con stock disponible
-- - reduce_size_stock() - Reduce stock de una talla
-- - add_size_stock() - Añade stock a una talla
-- - cancel_order_atomic() - Cancela pedido con restauración de stock
-- - validate_discount_code() - Valida códigos de descuento
-- - request_return() - Solicita devolución de pedido
-- - create_user_profile() - Crea perfil de usuario
--
-- ADMIN SETUP:
-- UPDATE user_profiles SET is_admin = true WHERE email = 'TU_EMAIL_AQUI';
--
-- VARIABLES DE ENTORNO REQUERIDAS:
-- - PUBLIC_SUPABASE_URL
-- - PUBLIC_SUPABASE_ANON_KEY
-- - SUPABASE_SERVICE_ROLE_KEY
-- - PUBLIC_STRIPE_PUBLIC_KEY
-- - STRIPE_SECRET_KEY
-- - PUBLIC_ADMIN_EMAIL
--
-- ============================================================================
