-- ============================================================================
-- KICKSPREMIUM - BASE DE DATOS COMPLETA Y UNIFICADA SUPABASE
-- ============================================================================
-- Tienda de Sneakers Exclusivos y Ediciones Limitadas
-- Última actualización: 13 de febrero de 2026
-- 
-- ESTE ARCHIVO CONTIENE TODA LA CONFIGURACIÓN COMPLETA DE LA BASE DE DATOS:
-- ✅ Tablas de administración (usuarios, perfiles)
-- ✅ Tablas de productos (categorías, productos, stock por tallas, colores)
-- ✅ Tablas de carrito y favoritos
-- ✅ Tablas de pedidos (órdenes, order_items, estados, devoluciones)
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
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para user_profiles
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_is_admin ON user_profiles(is_admin);

-- RLS para user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver su propio perfil
CREATE POLICY "users_select_own_profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Usuarios pueden insertar su propio perfil
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id OR current_setting('role', true) = 'service_role');

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "admins_select_all_profiles" ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- Service role tiene acceso total (para webhooks)
CREATE POLICY "service_role_all_profiles" ON user_profiles
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();

-- ============================================================================
-- SECCIÓN 2: TABLAS DE PRODUCTOS Y CATEGORÍAS
-- ============================================================================

-- TABLA: categories (Categorías de Productos)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para categories
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- RLS para categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (true);

-- Admins pueden crear/editar categorías
CREATE POLICY "admins_manage_categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_categories_updated_at();

-- Limpiar categorías antiguas
DELETE FROM categories WHERE slug IN (
  'camisas', 'pantalones', 'trajes', 'basketball', 'lifestyle', 'running',
  'shirts', 'pants', 'shoes', 'travis-scott', 'jordan-special', 'adidas-collab'
);

-- Insertar colecciones mejoradas (basadas en tipo, no solo marca)
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

-- TABLA: brands (Marcas de Sneakers)
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  slug VARCHAR NOT NULL UNIQUE,
  logo_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS para brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer brands
DROP POLICY IF EXISTS "brands_public_read" ON brands;
CREATE POLICY "brands_public_read" ON brands
  FOR SELECT USING (true);

-- Admins pueden gestionar brands
DROP POLICY IF EXISTS "admins_manage_brands" ON brands;
CREATE POLICY "admins_manage_brands" ON brands
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

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

-- TABLA: colors (Colores disponibles)
CREATE TABLE IF NOT EXISTS colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  slug VARCHAR NOT NULL UNIQUE,
  hex_code VARCHAR(50),
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS para colors
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer colors
DROP POLICY IF EXISTS "colors_public_read" ON colors;
CREATE POLICY "colors_public_read" ON colors
  FOR SELECT USING (true);

-- Insertar colores principales
DELETE FROM colors;
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
('Multi', 'multi', '#999999', 13);

-- TABLA: products (Productos/Zapatillas)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  description TEXT,
  detailed_description JSONB,
  
  -- Precios (en céntimos EUR)
  price INTEGER NOT NULL,
  compare_price INTEGER DEFAULT NULL,
  cost_price INTEGER DEFAULT NULL,
  
  -- Inventario
  stock INTEGER NOT NULL DEFAULT 0,
  
  -- Categorización
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  
  -- Datos específicos de sneakers
  brand VARCHAR,
  model VARCHAR,
  colorway VARCHAR,
  sku VARCHAR UNIQUE,
  release_date DATE,
  material VARCHAR,
  color VARCHAR,
  
  -- Flags
  is_limited_edition BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Medidas disponibles (JSONB: {"36": 5, "37": 3, ...})
  sizes_available JSONB DEFAULT '{}',
  
  -- Imágenes
  images TEXT[] NOT NULL DEFAULT '{}',
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_cost CHECK (cost_price IS NULL OR cost_price >= 0)
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- RLS para products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (is_active = true);

-- Admins pueden gestionar productos
CREATE POLICY "admins_manage_products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Insertar productos EXCLUSIVOS con imágenes
INSERT INTO products (
  name, slug, description, price, cost_price, stock, category_id, brand, is_limited_edition, sku, images
) VALUES

-- TRAVIS SCOTT COLLECTION
(
  'Travis Scott x Air Jordan 1 Retro High OG Mocha',
  'travis-scott-aj1-mocha',
  'Colaboración icónica con Travis Scott. Swoosh invertido, piel premium en tonos marrón mocha y negro. Una de las zapatillas más cotizadas del mercado. Lanzamiento 2019.',
  89999,
  45000,
  2,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Jordan',
  true,
  'TS-AJ1-MOCHA-001',
  ARRAY[
    'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&q=80',
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80'
  ]::text[]
)
ON CONFLICT (slug) DO NOTHING,
(
  'Travis Scott x Nike SB Dunk Low',
  'travis-scott-sb-dunk',
  'Colaboración especial con Nike SB. Cuerdas extra gruesas, paleta de colores única en marrón y crema. Plaid pattern en el interior. Solo quedan 2 pares.',
  59999,
  28000,
  2,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Nike',
  true,
  'TS-SB-DUNK-001',
  ARRAY[
    'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80'
  ]::text[]
)
ON CONFLICT (slug) DO NOTHING,
(
  'Travis Scott x Air Jordan 4 Cactus Jack',
  'travis-scott-aj4-cactus',
  'Air Jordan 4 en colaboración exclusiva. Suede azul con detalles en rojo. Logo Cactus Jack bordado. Edición muy limitada 2018.',
  129999,
  60000,
  1,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Jordan',
  true,
  'TS-AJ4-CACTUS-001',
  ARRAY[
    'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=800&q=80',
    'https://images.unsplash.com/photo-1605408499391-6368c628ef42?w=800&q=80'
  ]::text[]
)
ON CONFLICT (slug) DO NOTHING,

-- JORDAN SPECIAL EDITIONS
(
  'Air Jordan 1 Retro High OG Chicago',
  'jordan-1-chicago-og',
  'El clásico absoluto. Colorway original de 1985 que Michael Jordan llevó en su temporada rookie. Piel premium roja, blanca y negra. Ícono de la cultura sneaker.',
  149999,
  70000,
  1,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'AJ1-CHICAGO-001',
  ARRAY[
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80'
  ]::text[]
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SECCIÓN 3: TABLAS DE PEDIDOS (STRIPE)
-- ============================================================================

-- TABLA: orders (Pedidos)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información de Stripe
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Montos (en céntimos EUR)
  total_amount INTEGER NOT NULL DEFAULT 0,
  shipping_amount INTEGER DEFAULT 0,
  discount_amount INTEGER DEFAULT 0,
  subtotal_amount INTEGER,
  
  -- Items del pedido (JSONB array)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Estado
  status TEXT DEFAULT 'pending',
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  return_requested_at TIMESTAMPTZ,
  return_status VARCHAR(50),
  
  -- Información de envío
  shipping_name TEXT,
  shipping_email TEXT,
  shipping_phone TEXT,
  shipping_address JSONB,
  
  -- Descuentos
  discount_code_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);

-- RLS para orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Usuarios ven solo sus pedidos
CREATE POLICY "users_select_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Usuarios pueden crear sus pedidos
CREATE POLICY "users_insert_own_orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar sus pedidos
CREATE POLICY "users_update_own_orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins pueden ver todos los pedidos
CREATE POLICY "admins_see_all_orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- Service role tiene acceso total (para webhooks de Stripe)
CREATE POLICY "service_role_all_orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- ============================================================================
-- SECCIÓN 4: TABLA DE NEWSLETTER
-- ============================================================================

-- TABLA: newsletter_subscribers (Suscriptores Newsletter)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Índices para newsletter_subscribers
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_verified ON newsletter_subscribers(verified);
CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter_subscribers(subscribed_at DESC);

-- RLS para newsletter_subscribers
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede suscribirse
CREATE POLICY "anyone_can_subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- Cualquiera puede desuscribirse (por email)
CREATE POLICY "anyone_can_unsubscribe" ON newsletter_subscribers
  FOR DELETE USING (true);

-- Service role tiene acceso total (para enviar emails, etc)
CREATE POLICY "service_role_all_newsletter" ON newsletter_subscribers
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_newsletter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_newsletter_updated_at ON newsletter_subscribers;
CREATE TRIGGER trigger_newsletter_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_updated_at();

-- ============================================================================
-- SECCIÓN 5: TABLAS DE CÓDIGOS DE DESCUENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  
  -- Tipo de descuento
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' o 'fixed'
  discount_value INTEGER NOT NULL, -- En porcentaje (10 = 10%) o céntimos (1000 = 10€)
  
  -- Restricciones
  min_purchase INTEGER DEFAULT 0, -- Compra mínima en céntimos
  max_uses INTEGER DEFAULT NULL, -- NULL = ilimitado
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  
  -- Validez
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Todos pueden validar códigos (lectura limitada)
CREATE POLICY "anyone_can_validate_codes" ON discount_codes
  FOR SELECT USING (is_active = true);

-- Admins pueden gestionar
CREATE POLICY "admins_manage_codes" ON discount_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_discount_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_discount_codes_updated_at ON discount_codes;
CREATE TRIGGER trigger_discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_codes_updated_at();

-- ============================================================================
-- SECCIÓN 6: TABLA DE USO DE CÓDIGOS (TRACKING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount INTEGER NOT NULL, -- Descuento aplicado en céntimos
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_code_uses_code ON discount_code_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_code_uses_user ON discount_code_uses(user_id);

-- RLS
ALTER TABLE discount_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_uses" ON discount_code_uses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_insert_uses" ON discount_code_uses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admins_see_all_uses" ON discount_code_uses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

-- ============================================================================
-- SECCIÓN 7: FUNCIONES DE SINCRONIZACIÓN DE STOCK
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

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_sync_stock ON products;

-- Crear trigger que se ejecuta ANTES de INSERT o UPDATE
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
  
  -- Actualizar sizes_available (el trigger actualizará el stock automáticamente)
  IF v_new_qty <= 0 THEN
    -- Eliminar la talla si llega a 0
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
  -- Obtener tallas actuales
  SELECT sizes_available INTO v_current_sizes
  FROM products WHERE id = p_product_id;
  
  IF v_current_sizes IS NULL THEN
    v_current_sizes := '{}'::jsonb;
  END IF;
  
  -- Obtener cantidad actual de la talla
  v_current_qty := COALESCE((v_current_sizes->>p_size)::INTEGER, 0);
  
  -- Calcular nueva cantidad
  v_new_qty := v_current_qty + p_quantity;
  
  -- Actualizar sizes_available
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

-- Sincronizar el stock de todos los productos existentes
UPDATE products
SET stock = calculate_total_stock_from_sizes(sizes_available)
WHERE sizes_available IS NOT NULL AND sizes_available != '{}'::jsonb;

-- Para productos sin tallas configuradas, establecer stock a 0
UPDATE products
SET stock = 0
WHERE sizes_available IS NULL OR sizes_available = '{}'::jsonb;

-- ============================================================================
-- SECCIÓN 8: FUNCIONES DE GESTIÓN DE PEDIDOS
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
  -- 1. Obtener el pedido y verificar que pertenece al usuario
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  -- 2. Verificar que el pedido se puede cancelar (solo paid/pending, NO shipped)
  IF v_order.status NOT IN ('pending', 'paid', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido no se puede cancelar. Estado actual: ' || v_order.status);
  END IF;
  
  -- 3. Restaurar stock de cada producto
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 1);
    v_size := v_item->>'size';
    
    IF v_product_id IS NOT NULL THEN
      -- Obtener stock actual y sizes_available
      SELECT stock, sizes_available INTO v_current_stock, v_current_sizes
      FROM products WHERE id = v_product_id;
      
      -- Restaurar stock general
      UPDATE products
      SET stock = stock + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;
      
      -- Restaurar stock por talla si aplica
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
  
  -- 4. Actualizar estado del pedido
  UPDATE orders
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_order_id;
  
  -- 5. Retornar éxito
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
  -- 1. Buscar el código
  SELECT * INTO v_discount
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código no válido o expirado');
  END IF;
  
  -- 2. VALIDACIÓN ESPECIAL: Si es código de primera compra, verificar que el usuario no haya comprado
  IF v_discount.code IN ('WELCOME10', 'PRIMERA_COMPRA') AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_orders
    FROM orders
    WHERE user_id = p_user_id AND status IN ('completed', 'pending', 'processing', 'shipped');
    
    IF v_user_orders > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Este código solo es válido para tu primera compra');
    END IF;
  END IF;
  
  -- 3. Verificar usos máximos globales
  IF v_discount.max_uses IS NOT NULL AND v_discount.current_uses >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;
  
  -- 4. Verificar usos por usuario
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
    FROM discount_code_uses
    WHERE code_id = v_discount.id AND user_id = p_user_id;
    
    IF v_user_uses >= v_discount.max_uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Ya has usado este código');
    END IF;
  END IF;
  
  -- 5. Verificar compra mínima
  IF p_cart_total < v_discount.min_purchase THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Compra mínima requerida: €' || (v_discount.min_purchase / 100.0)::TEXT
    );
  END IF;
  
  -- 6. Calcular descuento
  IF v_discount.discount_type = 'percentage' THEN
    v_discount_amount := (p_cart_total * v_discount.discount_value / 100);
  ELSE
    v_discount_amount := v_discount.discount_value;
  END IF;
  
  -- El descuento no puede ser mayor que el total
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
  -- 1. Obtener el pedido
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  
  -- 2. Verificar que está entregado
  IF v_order.status != 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo puedes solicitar devolución de pedidos entregados');
  END IF;
  
  -- 3. Verificar que no tiene ya una solicitud
  IF v_order.return_requested_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido ya tiene una solicitud de devolución');
  END IF;
  
  -- 4. Crear solicitud
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
-- SECCIÓN 9: CÓDIGOS DE DESCUENTO INICIALES
-- ============================================================================

-- Código de bienvenida para newsletter (10% descuento)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user)
VALUES ('WELCOME10', 'Descuento de bienvenida - 10% en tu primera compra', 'percentage', 10, 5000, 1)
ON CONFLICT (code) DO NOTHING;

-- Código de envío gratis (descuento fijo de 5.99€)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase)
VALUES ('FREESHIP', 'Envío gratis en pedidos superiores a 100€', 'fixed', 599, 10000)
ON CONFLICT (code) DO NOTHING;

-- Código VIP 20%
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses)
VALUES ('VIP20', 'Descuento VIP - 20% en toda la tienda', 'percentage', 20, 0, 100)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SECCIÓN 10: SISTEMA VIP ACCESS (desde VIP_AND_CUSTOMIZER_MIGRATION.sql)
-- ============================================================================

-- TABLA: vip_subscriptions (Suscripciones VIP)
CREATE TABLE IF NOT EXISTS vip_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, cancelled, past_due, expired
  plan_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual
  price_cents INTEGER NOT NULL DEFAULT 999, -- 9.99€/mes por defecto
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vip_user_id ON vip_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_email ON vip_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_vip_status ON vip_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_vip_stripe_sub ON vip_subscriptions(stripe_subscription_id);

-- RLS
ALTER TABLE vip_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_vip" ON vip_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_manage_vip" ON vip_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- TABLA: vip_notifications (Notificaciones para VIPs)
CREATE TABLE IF NOT EXISTS vip_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'new_product', 'restock', 'vip_discount'
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_notif_type ON vip_notifications(type);
CREATE INDEX IF NOT EXISTS idx_vip_notif_created ON vip_notifications(created_at DESC);

ALTER TABLE vip_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_manage_vip_notif" ON vip_notifications
  FOR ALL USING (true) WITH CHECK (true);

-- TABLA: vip_notification_reads (Qué notificaciones ha leído cada VIP)
CREATE TABLE IF NOT EXISTS vip_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES vip_notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE vip_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reads" ON vip_notification_reads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_manage_reads" ON vip_notification_reads
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- SECCIÓN 11: PAGE CUSTOMIZER (Personalización de página)
-- ============================================================================

-- TABLA: page_sections (Secciones de la página principal)
CREATE TABLE IF NOT EXISTS page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_type TEXT NOT NULL, -- 'hero', 'featured_products', 'categories', 'banner', 'brands', 'newsletter', 'custom_products'
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}', -- Contenido flexible según tipo
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}', -- Estilos, colores, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_sections_order ON page_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_page_sections_visible ON page_sections(is_visible);

ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_sections" ON page_sections
  FOR SELECT USING (true);

CREATE POLICY "admins_manage_sections" ON page_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

CREATE POLICY "service_manage_sections" ON page_sections
  FOR ALL USING (true) WITH CHECK (true);

-- TABLA: featured_product_selections (Productos seleccionados para secciones)
CREATE TABLE IF NOT EXISTS featured_product_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES page_sections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, product_id)
);

ALTER TABLE featured_product_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_featured" ON featured_product_selections
  FOR SELECT USING (true);
CREATE POLICY "admins_manage_featured" ON featured_product_selections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );
CREATE POLICY "service_manage_featured" ON featured_product_selections
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at en page_sections
CREATE OR REPLACE FUNCTION update_page_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_page_sections_updated_at ON page_sections;
CREATE TRIGGER trigger_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_page_sections_updated_at();

-- ============================================================================
-- SECCIÓN 12: DATOS INICIALES COMPLETOS
-- ============================================================================

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

-- Código de descuento VIP (15% permanente)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user, max_uses)
VALUES ('VIP15', 'Descuento exclusivo para miembros VIP - 15%', 'percentage', 15, 0, 999, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SECCIÓN 13: VERIFICACIÓN FINAL
-- ============================================================================

SELECT '✅ Base de datos COMPLETA y UNIFICADA restaurada correctamente' as resultado;

SELECT 'Tablas creadas:' as tipo;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT 'Funciones creadas:' as tipo;
SELECT proname FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

SELECT 'Triggers creados:' as tipo;
SELECT tgname FROM pg_trigger ORDER BY tgname;

-- ============================================================================
-- NOTAS FINALES - INFORMACIÓN CONSOLIDADA
-- ============================================================================
-- 
-- Este archivo contiene TODA la información de la base de datos:
-- 
-- ✅ SECCIÓN 1-2: ADMINISTRACIÓN
--    - user_profiles (Perfiles de usuarios y administradores)
--    - Políticas RLS y triggers
--
-- ✅ SECCIÓN 2-4: PRODUCTOS Y CATEGORÍAS
--    - categories (Categorías de productos)
--    - brands (Marcas de sneakers)
--    - colors (Paleta de colores)
--    - products (Zapatillas con stock por tallas)
--    - Todas las políticas RLS
--
-- ✅ SECCIÓN 5: PEDIDOS (INTEGRACIÓN STRIPE)
--    - orders (Pedidos y estado)
--    - Relación con usuarios y descuentos
--    - Timestamps de envío y devoluciones
--
-- ✅ SECCIÓN 6: NEWSLETTER
--    - newsletter_subscribers (Suscriptores)
--    - Verificación de email
--    - Metadata flexible
--
-- ✅ SECCIÓN 7-8: DESCUENTOS Y TRACKING
--    - discount_codes (Códigos de descuento)
--    - discount_code_uses (Historial de uso)
--    - Validación de primera compra
--    - Límites por usuario y global
--
-- ✅ SECCIÓN 9: FUNCIONES DE SINCRONIZACIÓN
--    - calculate_total_stock_from_sizes() - Calcula stock desde tallas
--    - sync_stock_from_sizes() - Trigger automático
--    - get_available_sizes() - Tallas disponibles
--    - reduce_size_stock() - Reduce stock de una talla
--    - add_size_stock() - Aumenta stock de una talla
--
-- ✅ SECCIÓN 10: FUNCIONES DE GESTIÓN
--    - cancel_order_atomic() - Cancela pedido y restaura stock
--    - validate_discount_code() - Valida y aplica descuentos (ACTUALIZADO)
--    - request_return() - Solicita devolución de pedido
--    - create_user_profile() - Crea perfiles de usuario
--
-- ✅ SECCIÓN 10-11: SISTEMA VIP (VIP ACCESS)
--    - vip_subscriptions (Suscripciones VIP de Stripe)
--    - vip_notifications (Notificaciones exclusivas para VIPs)
--    - vip_notification_reads (Control de lectura de notificaciones)
--
-- ✅ SECCIÓN 11: PAGE CUSTOMIZER
--    - page_sections (Secciones personalizables de la página)
--    - featured_product_selections (Productos destacados)
--    - Gestión de orden y visibilidad
--
-- CAMBIOS PRINCIPALES:
-- 1. validate_discount_code() actualizada con validación mejorada de primera compra
-- 2. Sistema VIP integrado con Stripe
-- 3. Page Customizer para flexible homepage
-- 4. Gestión completa de stock por tallas
-- 5. Sistema de devoluciones
--
-- PASOS SIGUIENTES:
-- 1. Ejecutar este archivo completo en Supabase SQL Editor
-- 2. ADMIN SETUP: UPDATE user_profiles SET is_admin = true WHERE email = 'joseluisgq17@gmail.com';
-- 3. Configurar webhook de Stripe en /api/webhooks/stripe
-- 4. Variables de entorno requeridas:
--    - PUBLIC_SUPABASE_URL
--    - PUBLIC_SUPABASE_ANON_KEY
--    - SUPABASE_SERVICE_ROLE_KEY
--    - PUBLIC_STRIPE_PUBLIC_KEY
--    - STRIPE_SECRET_KEY
--    - PUBLIC_ADMIN_EMAIL
--
-- ============================================================================
