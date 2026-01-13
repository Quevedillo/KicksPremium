-- ============================================================================
-- KICKSPREMIUM - SETUP COMPLETO DE BASE DE DATOS
-- ============================================================================
-- Tienda de Sneakers Exclusivos y Ediciones Limitadas
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR/ACTUALIZAR TABLA CATEGORIES
-- ============================================================================

-- Agregar campos necesarios si no existen
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS icon VARCHAR,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Limpiar categorias antiguas (ropa, categorias genericas)
DELETE FROM categories WHERE slug IN (
  'camisas', 'pantalones', 'trajes', 
  'basketball', 'lifestyle', 'running',
  'shirts', 'pants', 'shoes'
);

-- Insertar colecciones EXCLUSIVAS de sneakers
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

-- ============================================================================
-- PASO 2: CREAR/ACTUALIZAR TABLA PRODUCTS
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informacion basica
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  description TEXT,
  
  -- Precios (en centimos EUR)
  price INTEGER NOT NULL,
  compare_price INTEGER DEFAULT NULL,
  cost_price INTEGER DEFAULT NULL,
  
  -- Inventario
  stock INTEGER NOT NULL DEFAULT 0,
  
  -- Categorizacion
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  
  -- Datos especificos de sneakers
  brand VARCHAR,
  sku VARCHAR,
  material VARCHAR,
  color VARCHAR,
  is_limited_edition BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Imagenes
  images TEXT[] NOT NULL DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_cost CHECK (cost_price IS NULL OR cost_price >= 0)
);

-- Agregar columnas si la tabla ya existe
ALTER TABLE products
ADD COLUMN IF NOT EXISTS brand VARCHAR,
ADD COLUMN IF NOT EXISTS sku VARCHAR,
ADD COLUMN IF NOT EXISTS material VARCHAR,
ADD COLUMN IF NOT EXISTS color VARCHAR,
ADD COLUMN IF NOT EXISTS compare_price INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Eliminar restricción NOT NULL de brand si existe (permitir valores NULL)
ALTER TABLE products
ALTER COLUMN brand DROP NOT NULL;

-- Crear indices para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- ============================================================================
-- PASO 3: CREAR TABLA ORDERS (Pedidos con Stripe)
-- ============================================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe info
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Monto (en centimos EUR)
  total_amount INTEGER NOT NULL DEFAULT 0,
  
  -- Items del pedido
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Estado
  status TEXT DEFAULT 'pending',
  
  -- Envio
  shipping_name TEXT,
  shipping_address JSONB,
  shipping_phone TEXT,
  billing_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas si la tabla ya existe
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'total_amount') THEN
    ALTER TABLE orders ADD COLUMN total_amount INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'stripe_session_id') THEN
    ALTER TABLE orders ADD COLUMN stripe_session_id TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id') THEN
    ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'items') THEN
    ALTER TABLE orders ADD COLUMN items JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'status') THEN
    ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Indices para orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Trigger para actualizar updated_at automaticamente
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
-- PASO 4: POLITICAS RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS en orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver solo sus propios pedidos
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Usuarios pueden insertar sus propios pedidos
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar sus propios pedidos
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role tiene acceso total (para webhooks)
DROP POLICY IF EXISTS "Service role full access" ON orders;
CREATE POLICY "Service role full access" ON orders
  FOR ALL USING (true) WITH CHECK (true);

-- Products: lectura publica
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
CREATE POLICY "Products are viewable by everyone" ON products
  FOR SELECT USING (true);

-- Categories: lectura publica
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

-- ============================================================================
-- PASO 5: PRODUCTOS EXCLUSIVOS DE EJEMPLO
-- ============================================================================

-- Limpiar productos antiguos (opcional - descomentar si necesario)
-- DELETE FROM products;

-- Insertar productos EXCLUSIVOS con imagenes reales
INSERT INTO products (
  name, slug, description, price, stock, category_id, brand, is_limited_edition, sku, images
) VALUES

-- TRAVIS SCOTT COLLECTION
(
  'Travis Scott x Air Jordan 1 Retro High OG Mocha',
  'travis-scott-aj1-mocha',
  'Colaboracion iconica con Travis Scott. Swoosh invertido, piel premium en tonos marron mocha y negro. Una de las zapatillas mas cotizadas del mercado. Lanzamiento 2019.',
  89999,
  2,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Jordan',
  true,
  'TS-AJ1-MOCHA-001',
  ARRAY[
    'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&q=80',
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80'
  ]::text[]
),
(
  'Travis Scott x Nike SB Dunk Low',
  'travis-scott-sb-dunk',
  'Colaboracion especial con Nike SB. Cuerdas extra gruesas, paleta de colores unica en marron y crema. Plaid pattern en el interior. Solo quedan 2 pares.',
  59999,
  2,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Nike',
  true,
  'TS-SB-DUNK-001',
  ARRAY[
    'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80'
  ]::text[]
),
(
  'Travis Scott x Air Jordan 4 Cactus Jack',
  'travis-scott-aj4-cactus',
  'Air Jordan 4 en colaboracion exclusiva. Suede azul con detalles en rojo. Logo Cactus Jack bordado. Edicion muy limitada 2018.',
  129999,
  1,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Jordan',
  true,
  'TS-AJ4-CACTUS-001',
  ARRAY[
    'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=800&q=80',
    'https://images.unsplash.com/photo-1605408499391-6368c628ef42?w=800&q=80'
  ]::text[]
),

-- JORDAN SPECIAL EDITIONS
(
  'Air Jordan 1 Retro High OG Chicago',
  'jordan-1-chicago-og',
  'El clasico absoluto. Colorway original de 1985 que Michael Jordan llevo en su temporada rookie. Piel premium roja, blanca y negra. Icono de la cultura sneaker.',
  149999,
  1,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'AJ1-CHICAGO-001',
  ARRAY[
    'https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=800&q=80',
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80'
  ]::text[]
),
(
  'Air Jordan 11 Retro Space Jam',
  'jordan-11-space-jam',
  'Edicion conmemorativa de la pelicula Space Jam (1996). Patent leather negro con suela translucida azul. El numero 45 en el talon. Pieza de coleccion.',
  79999,
  3,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'AJ11-SPACEJAM-001',
  ARRAY[
    'https://images.unsplash.com/photo-1575537302964-96cd47c06b1b?w=800&q=80',
    'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80'
  ]::text[]
),
(
  'Air Jordan 3 Retro Black Cement',
  'jordan-3-black-cement',
  'Diseno de Tinker Hatfield. Elephant print iconico, visible Air unit. La zapatilla que convencio a MJ de quedarse en Nike. Relanzamiento 2018.',
  69999,
  2,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'AJ3-BLACKCEMENT-001',
  ARRAY[
    'https://images.unsplash.com/photo-1543508282-6319a3e2621f?w=800&q=80',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80'
  ]::text[]
),
(
  'Air Jordan 4 Retro Bred',
  'jordan-4-bred',
  'Combinacion clasica negro y rojo (Bred). Fire Red accents. Una de las siluetas mas populares de la linea Jordan. Stock muy limitado.',
  64999,
  2,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'AJ4-BRED-001',
  ARRAY[
    'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&q=80',
    'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80'
  ]::text[]
),

-- ADIDAS COLLABORATIONS
(
  'Adidas Yeezy Boost 350 V2 Zebra',
  'adidas-yeezy-350-zebra',
  'Colaboracion Kanye West. Pattern zebra blanco y negro con SPLY-350 en rojo. Boost cushioning. Una de las Yeezys mas iconicas.',
  39999,
  4,
  (SELECT id FROM categories WHERE slug = 'adidas-collab'),
  'Adidas',
  true,
  'YEEZY-350-ZEBRA-001',
  ARRAY[
    'https://images.unsplash.com/photo-1586525198428-225f6f12cff5?w=800&q=80',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80'
  ]::text[]
),
(
  'Adidas Yeezy 700 Wave Runner',
  'adidas-yeezy-700-wave',
  'El modelo que revivio la estetica chunky dad shoe. Combinacion de gris, teal y naranja. Boost midsole. Diseno futurista de Kanye.',
  54999,
  2,
  (SELECT id FROM categories WHERE slug = 'adidas-collab'),
  'Adidas',
  true,
  'YEEZY-700-WAVE-001',
  ARRAY[
    'https://images.unsplash.com/photo-1620138546344-7b2c38516edf?w=800&q=80',
    'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80'
  ]::text[]
),
(
  'Adidas x Pharrell Williams NMD Hu',
  'adidas-pharrell-nmd-hu',
  'Colaboracion con Pharrell Williams. Primeknit upper con mensaje HUMAN RACE. Boost cushioning. Colores vibrantes exclusivos.',
  44999,
  3,
  (SELECT id FROM categories WHERE slug = 'adidas-collab'),
  'Adidas',
  true,
  'PHARRELL-NMD-HU-001',
  ARRAY[
    'https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80',
    'https://images.unsplash.com/photo-1605034313761-73ea4a0cfbf3?w=800&q=80'
  ]::text[]
),

-- EXCLUSIVE DROPS
(
  'Nike Air Max 90 x Off-White Desert Ore',
  'nike-air-max-90-off-white',
  'Diseno de Virgil Abloh para Nike The Ten. Paneles transparentes, texto deconstructivo, zip-tie naranja. Arte wearable.',
  129999,
  1,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'Nike',
  true,
  'AIRMAX90-OW-001',
  ARRAY[
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80'
  ]::text[]
),
(
  'New Balance 550 x Aime Leon Dore Green',
  'nb-550-aime-leon-dore',
  'Colaboracion que revivio el modelo 550. Piel premium blanca con acentos en verde. La zapatilla que puso a ALD en el mapa sneaker.',
  34999,
  3,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'New Balance',
  true,
  'NB550-ALD-GREEN-001',
  ARRAY[
    'https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80',
    'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80'
  ]::text[]
),
(
  'Nike Dunk Low x Grateful Dead Green Bear',
  'nike-dunk-grateful-dead',
  'Colaboracion con Grateful Dead. Fur upper verde con bolsillo oculto. Oso bordado. Una de las dunks mas creativas jamas hechas.',
  89999,
  1,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'Nike',
  true,
  'DUNK-GD-GREEN-001',
  ARRAY[
    'https://images.unsplash.com/photo-1514989940723-e8e51d675571?w=800&q=80',
    'https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80'
  ]::text[]
),
(
  'Sacai x Nike LDWaffle Blue Multi',
  'sacai-nike-ldwaffle',
  'Chitose Abe fusiona dos modelos clasicos Nike. Doble swoosh, doble lengüeta, doble suela. Revoluciono el diseno de sneakers.',
  74999,
  2,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'Nike',
  true,
  'SACAI-LDWAFFLE-001',
  ARRAY[
    'https://images.unsplash.com/photo-1595341888016-a392ef81b7de?w=800&q=80',
    'https://images.unsplash.com/photo-1603787081207-362bcef7c144?w=800&q=80'
  ]::text[]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  category_id = EXCLUDED.category_id,
  brand = EXCLUDED.brand,
  is_limited_edition = EXCLUDED.is_limited_edition,
  images = EXCLUDED.images;

-- ============================================================================
-- PASO 6: VERIFICACION
-- ============================================================================

-- Verificar categorias
SELECT 'Categorias:' as info;
SELECT id, name, slug, icon, display_order FROM categories ORDER BY display_order;

-- Verificar productos por categoria
SELECT 'Productos por categoria:' as info;
SELECT c.name as categoria, COUNT(p.id) as total_productos
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY c.display_order;

-- Verificar tabla orders
SELECT 'Tabla orders existe:' as info;
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'orders'
) AS orders_exists;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 
-- 1. PRECIOS: Todos los precios estan en CENTIMOS (cents)
--    - 89999 = 899.99 EUR
--    - 149999 = 1499.99 EUR
--
-- 2. IMAGENES: Usando URLs de Unsplash para demo
--    - Reemplazar con URLs propias para produccion
--
-- 3. MONEDA: Toda la tienda usa EUR (euros)
--
-- 4. SKU: Campo obligatorio (NOT NULL) - cada producto necesita SKU unico
--
-- 5. RLS: Row Level Security habilitado en orders, products, categories
--
-- ============================================================================
