-- ============================================================================
-- KICKSPREMIUM - SETUP COMPLETO DE BASE DE DATOS SUPABASE
-- ============================================================================
-- Tienda de Sneakers Exclusivos y Ediciones Limitadas
-- Última actualización: 19 de enero de 2026
-- 
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard > SQL Editor > New Query
-- 2. Copiar este archivo completo
-- 3. Ejecutar todo (recomendado hacerlo en bloques/secciones)
-- 4. Verificar que no haya errores
--
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
  WITH CHECK (auth.uid() = id);

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
  
  -- Items del pedido (JSONB array)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Estado
  status TEXT DEFAULT 'pending',
  
  -- Información de envío
  shipping_name TEXT,
  shipping_email TEXT,
  shipping_phone TEXT,
  shipping_address JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

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
-- SECCIÓN 5: DATOS DE EJEMPLO (PRODUCTOS EXCLUSIVOS)
-- ============================================================================

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
-- SECCIÓN 6: VERIFICACIÓN Y LIMPIEZA
-- ============================================================================

-- Mostrar todas las tablas creadas
SELECT 'Base de datos configurada correctamente:' as status;

-- Mostrar políticas RLS
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'products', 'categories', 'orders', 'newsletter_subscribers')
ORDER BY tablename, policyname;

-- Mostrar índices
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

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
-- ============================================================================
