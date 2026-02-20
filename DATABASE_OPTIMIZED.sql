-- ============================================================================
-- KICKSPREMIUM - BASE DE DATOS OPTIMIZADA - SUPABASE
-- ============================================================================
-- Tienda de Sneakers Exclusivos y Ediciones Limitadas
-- Última actualización: Junio 2025
-- 
-- OPTIMIZACIÓN REALIZADA:
-- ✅ Eliminadas 9 tablas sin uso en el código:
--    - cart_items (el carrito es 100% client-side con localStorage)
--    - favorites (sin queries Supabase en el código)
--    - product_colors (los productos usan campos color/colorway directamente)
--    - order_items (los pedidos usan JSONB items[] en orders)
--    - product_reviews (sin implementación en frontend)
--    - restock_alerts (sin implementación en frontend)
--    - vip_subscriptions (sistema VIP eliminado)
--    - vip_notifications (sistema VIP eliminado)
--    - vip_notification_reads (sistema VIP eliminado)
-- ✅ Eliminadas columnas redundantes en orders:
--    - total_price (duplicaba total_amount)
--    - stripe_payment_id (duplicaba stripe_payment_intent_id)
--    - subtotal_amount (nunca escrita por el código)
--    - discount_amount (nunca escrita en orders, existe en discount_code_uses)
--    - discount_code_id (nunca escrita por el código)
-- ✅ Soporte para Guest Checkout (compra sin cuenta):
--    - orders.user_id es nullable
--    - Índice en billing_email para buscar pedidos de invitados
--    - RLS actualizado para permitir inserciones via service role
--    - cancel_order_atomic actualizado para pedidos de invitados
-- ✅ Eliminado todo el sistema VIP
-- ✅ Eliminados códigos de descuento VIP (VIP15, VIP20)
--
-- TABLAS FINALES (11 tablas):
-- 1.  user_profiles - Perfiles de usuarios y administradores
-- 2.  brands - Marcas de sneakers
-- 3.  categories - Categorías de productos
-- 4.  colors - Colores disponibles
-- 5.  products - Productos/Zapatillas
-- 6.  discount_codes - Códigos de descuento
-- 7.  discount_code_uses - Tracking de uso de códigos
-- 8.  orders - Pedidos (con soporte guest checkout)
-- 9.  newsletter_subscribers - Suscriptores newsletter
-- 10. page_sections - Secciones de página personalizables
-- 11. featured_product_selections - Productos destacados por sección
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

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);

-- ============================================================================
-- SECCIÓN 3: TABLAS DE DESCUENTOS
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

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- ============================================================================
-- SECCIÓN 4: TABLAS DE PEDIDOS
-- ============================================================================

-- TABLA: orders (Pedidos - con soporte Guest Checkout)
-- user_id es nullable: NULL = pedido de invitado (guest checkout)
-- billing_email se usa para vincular pedidos cuando el invitado se registre
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL para guest checkout
  
  -- Estado
  status CHARACTER VARYING DEFAULT 'pending',
  
  -- Monto total (en céntimos EUR)
  total_amount INTEGER NOT NULL DEFAULT 0,
  
  -- Items del pedido (JSONB array con id, name, brand, price, qty, size, img)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Información de Stripe
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Información de envío
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_address JSONB,
  billing_email TEXT, -- Clave para vincular pedidos de invitados con futuras cuentas
  notes TEXT,
  
  -- Estados y timestamps de gestión
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

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_billing_email ON orders(billing_email); -- Para vincular pedidos de invitados
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);

-- TABLA: discount_code_uses (Tracking de uso de códigos)
CREATE TABLE IF NOT EXISTS public.discount_code_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL para guest checkout
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount INTEGER NOT NULL, -- Descuento aplicado en céntimos
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_uses_code ON discount_code_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_code_uses_user ON discount_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_code_uses_order ON discount_code_uses(order_id);

-- ============================================================================
-- SECCIÓN 5: TABLA DE NEWSLETTER
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

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_verified ON newsletter_subscribers(verified);
CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter_subscribers(subscribed_at DESC);

-- ============================================================================
-- SECCIÓN 6: PAGE CUSTOMIZER (Personalización de página)
-- ============================================================================

-- TABLA: page_sections (Secciones de la página principal)
CREATE TABLE IF NOT EXISTS public.page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_type TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_featured_section ON featured_product_selections(section_id);
CREATE INDEX IF NOT EXISTS idx_featured_product ON featured_product_selections(product_id);

-- ============================================================================
-- SECCIÓN 7: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_product_selections ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: user_profiles
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile" ON public.user_profiles
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "admins_read_all_profiles" ON public.user_profiles;
-- REMOVED: Causaba recursión infinita. Se verifica admin en backend.

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile" ON public.user_profiles
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id) OR (current_setting('role', true) = 'service_role'));

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile" ON public.user_profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins_update_any_profile" ON public.user_profiles;
-- REMOVED: Causaba recursión infinita. Se verifica admin en backend.

DROP POLICY IF EXISTS "service_role_all_profiles" ON public.user_profiles;
CREATE POLICY "service_role_all_profiles" ON public.user_profiles
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- POLÍTICAS: brands
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

-- POLÍTICAS: categories
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- POLÍTICAS: colors
DROP POLICY IF EXISTS "colors_public_read" ON public.colors;
CREATE POLICY "colors_public_read" ON public.colors
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- POLÍTICAS: products
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "authenticated_manage_products" ON public.products;
CREATE POLICY "authenticated_manage_products" ON public.products
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- POLÍTICAS: discount_codes
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

-- POLÍTICAS: discount_code_uses (privado por usuario)
DROP POLICY IF EXISTS "users_see_own_uses" ON public.discount_code_uses;
CREATE POLICY "users_see_own_uses" ON public.discount_code_uses
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id OR (user_id IS NULL AND current_setting('role', true) = 'service_role'));

DROP POLICY IF EXISTS "service_insert_uses" ON public.discount_code_uses;
CREATE POLICY "service_insert_uses" ON public.discount_code_uses
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (current_setting('role', true) = 'service_role');

-- POLÍTICAS: orders (actualizado para guest checkout)
-- Los usuarios ven SOLO sus propios pedidos
DROP POLICY IF EXISTS "users_view_own_orders" ON public.orders;
CREATE POLICY "users_view_own_orders" ON public.orders
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id OR (user_id IS NULL AND current_setting('role', true) = 'service_role'));

-- Los usuarios pueden crear Sus propios pedidos SOLO
DROP POLICY IF EXISTS "users_create_orders" ON public.orders;
CREATE POLICY "users_create_orders" ON public.orders
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar SOLO sus propios pedidos
DROP POLICY IF EXISTS "users_update_own_orders" ON public.orders;
CREATE POLICY "users_update_own_orders" ON public.orders
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (backend/webhooks) tiene acceso completo SOLO cuando es service_role
DROP POLICY IF EXISTS "service_role_full_orders" ON public.orders;
CREATE POLICY "service_role_full_orders" ON public.orders
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- POLÍTICAS: newsletter_subscribers
DROP POLICY IF EXISTS "anyone_can_subscribe" ON public.newsletter_subscribers;
CREATE POLICY "anyone_can_subscribe" ON public.newsletter_subscribers
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone_can_unsubscribe" ON public.newsletter_subscribers;
CREATE POLICY "anyone_can_unsubscribe" ON public.newsletter_subscribers
  AS PERMISSIVE FOR DELETE TO public
  USING (true);

DROP POLICY IF EXISTS "anyone_can_read_newsletter" ON public.newsletter_subscribers;
CREATE POLICY "anyone_can_read_newsletter" ON public.newsletter_subscribers
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "service_role_all_newsletter" ON public.newsletter_subscribers;
CREATE POLICY "service_role_all_newsletter" ON public.newsletter_subscribers
  AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- POLÍTICAS: page_sections
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

-- POLÍTICAS: featured_product_selections
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
-- SECCIÓN 8: TRIGGERS Y FUNCIONES
-- ============================================================================

-- FUNCIÓN: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_newsletter_updated_at ON newsletter_subscribers;
CREATE TRIGGER trigger_newsletter_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_discount_codes_updated_at ON discount_codes;
CREATE TRIGGER trigger_discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_page_sections_updated_at ON page_sections;
CREATE TRIGGER trigger_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECCIÓN 9: FUNCIONES DE GESTIÓN DE STOCK
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
  calculated_stock := calculate_total_stock_from_sizes(NEW.sizes_available);
  NEW.stock := calculated_stock;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_stock ON products;
CREATE TRIGGER trigger_sync_stock
  BEFORE INSERT OR UPDATE OF sizes_available
  ON products
  FOR EACH ROW EXECUTE FUNCTION sync_stock_from_sizes();

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
  SELECT sizes_available INTO v_current_sizes
  FROM products WHERE id = p_product_id;
  
  IF v_current_sizes IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado');
  END IF;
  
  v_current_qty := COALESCE((v_current_sizes->>p_size)::INTEGER, 0);
  
  IF v_current_qty < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Stock insuficiente para talla ' || p_size,
      'available', v_current_qty,
      'requested', p_quantity
    );
  END IF;
  
  v_new_qty := v_current_qty - p_quantity;
  
  IF v_new_qty <= 0 THEN
    v_new_sizes := v_current_sizes - p_size;
  ELSE
    v_new_sizes := jsonb_set(v_current_sizes, ARRAY[p_size], to_jsonb(v_new_qty));
  END IF;
  
  UPDATE products
  SET sizes_available = v_new_sizes, updated_at = NOW()
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
  SET sizes_available = v_new_sizes, updated_at = NOW()
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
-- SECCIÓN 10: FUNCIONES DE GESTIÓN DE PEDIDOS
-- ============================================================================

-- FUNCIÓN: Cancelar pedido (transacción atómica)
-- Soporta pedidos de usuarios autenticados Y guest checkout
-- FLUJO DE ESTADOS:
--   paid       → cliente cancela → cancelled (reembolso inmediato)
--   shipped    → cliente solicita → processing (pendiente admin)
--   processing → admin confirma  → cancelled (reembolso + email)
CREATE OR REPLACE FUNCTION cancel_order_atomic(
  p_order_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Cancelado por el cliente',
  p_is_admin BOOLEAN DEFAULT FALSE
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
  -- Buscar pedido: si p_user_id es null, solo busca por order_id (admin)
  -- Si p_user_id no es null, verifica que el pedido pertenezca al usuario
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id AND user_id = p_user_id;
  ELSE
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id;
  END IF;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  -- CLIENTE: solo puede cancelar directamente si estado es 'paid'
  -- Si está en 'shipped', se marca como 'processing' (pendiente admin)
  IF NOT p_is_admin THEN
    IF v_order.status = 'paid' THEN
      -- Cancelación directa: restaurar stock y marcar como cancelado
      NULL; -- Continuar con la cancelación abajo
    ELSIF v_order.status = 'shipped' THEN
      -- Solo marcar como procesando, el admin debe aprobar
      UPDATE orders
      SET status = 'processing',
          cancelled_reason = p_reason,
          updated_at = NOW()
      WHERE id = p_order_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'pending_admin',
        'message', 'Solicitud de cancelación enviada. Un administrador la revisará.',
        'order_id', p_order_id
      );
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Este pedido no se puede cancelar. Estado actual: ' || v_order.status);
    END IF;
  ELSE
    -- ADMIN: puede cancelar pedidos en paid, shipped o processing
    IF v_order.status NOT IN ('paid', 'shipped', 'processing') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este pedido no se puede cancelar. Estado actual: ' || v_order.status);
    END IF;
  END IF;
  
  -- Restaurar stock de cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'id')::UUID;
    IF v_product_id IS NULL THEN
      v_product_id := (v_item->>'product_id')::UUID;
    END IF;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 1);
    v_size := v_item->>'size';
    
    IF v_product_id IS NOT NULL THEN
      SELECT stock, sizes_available INTO v_current_stock, v_current_sizes
      FROM products WHERE id = v_product_id;
      
      UPDATE products
      SET stock = stock + v_quantity, updated_at = NOW()
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
  
  -- Actualizar estado del pedido a cancelado
  UPDATE orders
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'cancelled',
    'message', 'Pedido cancelado correctamente',
    'order_id', p_order_id,
    'needs_refund', true
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- FUNCIÓN: Validar y aplicar código de descuento
-- Soporta p_user_id NULL para guest checkout
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
  
  -- Verificar restricción de primera compra (solo para usuarios autenticados)
  IF v_discount.code IN ('WELCOME10', 'PRIMERA_COMPRA') AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_orders
    FROM orders
    WHERE user_id = p_user_id AND status IN ('paid', 'completed', 'processing', 'shipped');
    
    IF v_user_orders > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Este código solo es válido para tu primera compra');
    END IF;
  END IF;
  
  -- Verificar límite global de usos
  IF v_discount.max_uses IS NOT NULL AND v_discount.current_uses >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;
  
  -- Verificar límite por usuario (solo para usuarios autenticados)
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
    FROM discount_code_uses
    WHERE code_id = v_discount.id AND user_id = p_user_id;
    
    IF v_user_uses >= v_discount.max_uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Ya has usado este código');
    END IF;
  END IF;
  
  -- Verificar compra mínima
  IF p_cart_total < v_discount.min_purchase THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Compra mínima requerida: €' || (v_discount.min_purchase / 100.0)::TEXT
    );
  END IF;
  
  -- Calcular descuento
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
-- Soporta p_user_id NULL para administración
CREATE OR REPLACE FUNCTION request_return(
  p_order_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Solicitud de devolución del cliente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id AND user_id = p_user_id;
  ELSE
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id;
  END IF;
  
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

-- FUNCIÓN: Vincular pedidos de invitado a un usuario registrado
-- Llamar cuando un usuario se registra para vincular sus pedidos previos por email
CREATE OR REPLACE FUNCTION link_guest_orders_to_user(
  p_user_id UUID,
  p_email TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE orders
  SET user_id = p_user_id, updated_at = NOW()
  WHERE user_id IS NULL
    AND billing_email = p_email;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- SECCIÓN 11: DATOS INICIALES
-- ============================================================================

-- Marcas principales (Los productos Yeezy usan brand_id de Adidas)
INSERT INTO brands (name, slug, is_featured, display_order) VALUES
('Nike', 'nike', true, 1),
('Jordan', 'jordan', true, 2),
('Adidas', 'adidas', true, 3),
('New Balance', 'new-balance', true, 4),
('Puma', 'puma', true, 5),
('Converse', 'converse', true, 6),
('Vans', 'vans', false, 7),
('ASICS', 'asics', false, 8),
('Reebok', 'reebok', false, 9),
('Salomon', 'salomon', false, 10)
ON CONFLICT (slug) DO UPDATE SET
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order;

-- Categorías
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
('Todos los Kicks', 'all-kicks', 'Explora toda nuestra colección de sneakers auténticos', '👟', 1),
('Travis Scott', 'travis-scott', 'Colaboraciones exclusivas de Travis Scott con Jordan y Nike', '🔥', 2),
('Jordan Special', 'jordan-special', 'Air Jordans de ediciones especiales y limitadas', '🏀', 3),
('Exclusive Drops', 'exclusive-drops', 'Lanzamientos exclusivos y ediciones limitadas', '💎', 4),
('Retro Classics', 'retro-classics', 'Modelos icónicos de los 80s y 90s', '🕰️', 5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

-- Colores principales
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

-- Códigos de descuento (sin VIP)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user)
VALUES ('WELCOME10', 'Descuento de bienvenida - 10% en tu primera compra', 'percentage', 10, 5000, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase)
VALUES ('FREESHIP', 'Envío gratis en pedidos superiores a 100€', 'fixed', 599, 10000)
ON CONFLICT (code) DO NOTHING;

-- Secciones de la página
INSERT INTO page_sections (section_type, title, subtitle, display_order, is_visible, content, settings) VALUES
('hero', 'SNEAKERS AUTÉNTICOS & EXCLUSIVOS', 'Ediciones limitadas, colaboraciones y piezas de colección. Travis Scott • Jordan Special • Exclusive Drops • Limited Editions', 1, true, 
  '{"cta_primary": {"text": "Explorar Catálogo", "url": "/categoria/all-kicks"}, "cta_secondary": {"text": "Ver Exclusivas", "url": "/categoria/exclusive-drops"}, "badge": "100% Authentic"}'::jsonb,
  '{"bg_color": "brand-black", "text_color": "white"}'::jsonb),
('brands_bar', 'Marcas Destacadas', null, 2, true,
  '{"brands": ["Nike", "Jordan", "Adidas", "New Balance", "Puma", "Converse"]}'::jsonb,
  '{}'::jsonb),
('categories', 'Colecciones', 'Descubre nuestras colecciones curadas', 3, true,
  '{}'::jsonb,
  '{"columns": 4}'::jsonb),
('featured_products', 'Lo Más Vendido', 'Productos destacados ahora', 4, true,
  '{"max_products": 6}'::jsonb,
  '{"columns": 3}'::jsonb),
('newsletter', 'No te pierdas ningún lanzamiento', 'Suscríbete y sé el primero en enterarte de nuevos drops, exclusivas y ofertas especiales', 5, true,
  '{}'::jsonb,
  '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECCIÓN 12: VERIFICACIÓN FINAL
-- ============================================================================

SELECT '✅ Base de datos OPTIMIZADA creada correctamente' as resultado;

SELECT 
  'Tablas creadas: ' || COUNT(*)::TEXT as info
FROM pg_tables 
WHERE schemaname = 'public';

-- ============================================================================
-- NOTAS FINALES
-- ============================================================================
-- 
-- TABLAS (11):
-- 1.  user_profiles        - Perfiles de usuarios y administradores
-- 2.  brands               - Marcas de sneakers
-- 3.  categories           - Categorías de productos
-- 4.  colors               - Colores disponibles
-- 5.  products             - Productos/Zapatillas
-- 6.  discount_codes       - Códigos de descuento
-- 7.  discount_code_uses   - Tracking de uso de códigos
-- 8.  orders               - Pedidos (soporta guest checkout)
-- 9.  newsletter_subscribers - Suscriptores newsletter
-- 10. page_sections        - Secciones de página personalizables
-- 11. featured_product_selections - Productos destacados por sección
--
-- FUNCIONES:
-- - update_updated_at_column()     - Trigger genérico para updated_at
-- - calculate_total_stock_from_sizes() - Calcula stock total desde tallas
-- - sync_stock_from_sizes()        - Sincroniza stock automáticamente
-- - get_available_sizes()          - Obtiene tallas con stock disponible
-- - reduce_size_stock()            - Reduce stock de una talla
-- - add_size_stock()               - Añade stock a una talla
-- - cancel_order_atomic()          - Cancela pedido con restauración de stock
-- - validate_discount_code()       - Valida códigos de descuento
-- - request_return()               - Solicita devolución de pedido
-- - create_user_profile()          - Crea perfil de usuario
-- - link_guest_orders_to_user()    - Vincula pedidos de invitado a usuario registrado
--
-- GUEST CHECKOUT:
-- - Los pedidos de invitado tienen user_id = NULL
-- - billing_email se usa como identificador del invitado
-- - Cuando un invitado se registra, llamar:
--   SELECT link_guest_orders_to_user('user-uuid', 'email@ejemplo.com');
--
-- ADMIN SETUP:
-- UPDATE user_profiles SET is_admin = true WHERE email = 'TU_EMAIL_AQUI';
--
-- ============================================================================
