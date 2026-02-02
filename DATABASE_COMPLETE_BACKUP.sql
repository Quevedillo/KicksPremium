-- ============================================================================
-- KICKSPREMIUM - RESPALDO COMPLETO DE BASE DE DATOS SUPABASE
-- ============================================================================
-- Tienda de Sneakers Exclusivos y Ediciones Limitadas
-- Contiene TODAS las tablas, columnas, RLS, funciones y triggers
-- Ejecutar en orden si se necesita recuperar la base de datos completa
-- ============================================================================
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard > SQL Editor > New Query
-- 2. Copiar este archivo completo
-- 3. Ejecutar TODO de una vez (este script está optimizado para hacerlo)
-- 4. Verificar que no haya errores al final
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: TABLAS DE ADMINISTRACIÓN
-- ============================================================================

-- TABLA: user_profiles (Perfiles de Usuarios y Admin)
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
  'shirts', 'pants', 'shoes'
);

-- Insertar colecciones EXCLUSIVAS
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
('Travis Scott', 'travis-scott', 'Colaboraciones exclusivas de Travis Scott con Jordan y Nike', 'TS', 1),
('Jordan Special', 'jordan-special', 'Air Jordans de ediciones especiales y limitadas', 'JS', 2),
('Adidas Collab', 'adidas-collab', 'Colaboraciones exclusivas de Adidas con artistas reconocidos', 'AC', 3),
('Exclusive Drops', 'limited-editions', 'Ediciones limitadas, one-of-a-kind y piezas muy raras', 'EX', 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

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
-- SECCIÓN 5: TABLA DE CÓDIGOS DE DESCUENTO
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
  
  -- 2. Verificar usos máximos globales
  IF v_discount.max_uses IS NOT NULL AND v_discount.current_uses >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;
  
  -- 3. Verificar usos por usuario
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
    FROM discount_code_uses
    WHERE code_id = v_discount.id AND user_id = p_user_id;
    
    IF v_user_uses >= v_discount.max_uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Ya has usado este código');
    END IF;
  END IF;
  
  -- 4. Verificar compra mínima
  IF p_cart_total < v_discount.min_purchase THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Compra mínima requerida: €' || (v_discount.min_purchase / 100.0)::TEXT
    );
  END IF;
  
  -- 5. Calcular descuento
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
-- SECCIÓN 9: VERIFICACIÓN FINAL
-- ============================================================================

SELECT '✅ Base de datos restaurada correctamente' as status;
SELECT 'Tablas creadas:' as type;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT 'Funciones creadas:' as type;
SELECT proname FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

SELECT 'Triggers creados:' as type;
SELECT tgname FROM pg_trigger ORDER BY tgname;

-- ============================================================================
-- NOTAS FINALES
-- ============================================================================
-- 
-- 1. ADMIN SETUP: Ejecutar después de que el usuario se registre:
--    UPDATE user_profiles SET is_admin = true WHERE email = 'joseluisgq17@gmail.com';
--
-- 2. STRIPE WEBHOOK: Configurar en Stripe Dashboard para que envíe eventos a:
--    /api/webhooks/stripe
--
-- 3. ENVIRONMENT VARIABLES necesarias:
--    - PUBLIC_SUPABASE_URL
--    - PUBLIC_SUPABASE_ANON_KEY
--    - SUPABASE_SERVICE_ROLE_KEY
--    - PUBLIC_STRIPE_KEY
--    - STRIPE_SECRET_KEY
--    - PUBLIC_ADMIN_EMAIL
--
-- 4. Para más información sobre RLS: 
--    https://supabase.com/docs/guides/auth/row-level-security
--
-- 5. Este archivo contiene:
--    ✅ Todas las tablas con columnas
--    ✅ Todas las políticas RLS
--    ✅ Todos los índices
--    ✅ Todos los triggers
--    ✅ Todas las funciones
--    ✅ Datos de ejemplo
--
-- ============================================================================
