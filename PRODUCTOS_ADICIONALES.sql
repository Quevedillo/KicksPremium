-- ============================================================================
-- SQL ZAPATOS PREMIUM - PRODUCTOS ADICIONALES Y FILTROS
-- Ejecutar en Supabase Console (SQL Editor)
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR TABLA DE MARCAS
-- ============================================================================

DROP TABLE IF EXISTS brands CASCADE;

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  slug VARCHAR NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar marcas
INSERT INTO brands (name, slug, logo_url, description, display_order, is_featured) VALUES
('Nike', 'nike', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png', 'Just Do It - La marca deportiva más icónica del mundo', 1, TRUE),
('Jordan', 'jordan', 'https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Jumpman_logo.svg/200px-Jumpman_logo.svg.png', 'El legado de Michael Jordan en cada sneaker', 2, TRUE),
('Adidas', 'adidas', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Adidas_Logo.svg/200px-Adidas_Logo.svg.png', 'Impossible is Nothing - Innovación alemana', 3, TRUE),
('Yeezy', 'yeezy', NULL, 'Colaboración exclusiva Kanye West x Adidas', 4, TRUE),
('New Balance', 'new-balance', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/New_Balance_logo.svg/200px-New_Balance_logo.svg.png', 'Made in USA - Calidad y confort premium', 5, TRUE),
('Puma', 'puma', NULL, 'Forever Faster - Estilo y rendimiento', 6, FALSE),
('Converse', 'converse', NULL, 'Classic American Style desde 1908', 7, FALSE),
('Reebok', 'reebok', NULL, 'Sport The Unexpected', 8, FALSE),
('Vans', 'vans', NULL, 'Off The Wall - Cultura skate y street', 9, FALSE),
('ASICS', 'asics', NULL, 'Sound Mind, Sound Body - Running japonés', 10, FALSE);

-- ============================================================================
-- PASO 2: CREAR TABLA DE COLORES
-- ============================================================================

DROP TABLE IF EXISTS colors CASCADE;

CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  hex_code VARCHAR(7) NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar colores
INSERT INTO colors (name, slug, hex_code, display_order) VALUES
('Negro', 'negro', '#000000', 1),
('Blanco', 'blanco', '#FFFFFF', 2),
('Rojo', 'rojo', '#FF0000', 3),
('Azul', 'azul', '#0066CC', 4),
('Verde', 'verde', '#00AA00', 5),
('Amarillo', 'amarillo', '#FFCC00', 6),
('Naranja', 'naranja', '#FF6600', 7),
('Rosa', 'rosa', '#FF69B4', 8),
('Gris', 'gris', '#808080', 9),
('Marrón', 'marron', '#8B4513', 10),
('Beige', 'beige', '#F5F5DC', 11),
('Morado', 'morado', '#800080', 12),
('Multicolor', 'multicolor', '#FF00FF', 13);

-- ============================================================================
-- PASO 3: CREAR TABLA INTERMEDIA PRODUCTO-COLORES
-- ============================================================================

DROP TABLE IF EXISTS product_colors CASCADE;

CREATE TABLE product_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  UNIQUE(product_id, color_id)
);

-- ============================================================================
-- PASO 4: AÑADIR COLUMNA BRAND_ID A PRODUCTS (si no existe)
-- ============================================================================

-- Primero verificamos si la columna existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'brand_id'
  ) THEN
    ALTER TABLE products ADD COLUMN brand_id UUID REFERENCES brands(id);
  END IF;
END $$;

-- ============================================================================
-- PASO 5: INSERTAR MUCHOS MÁS PRODUCTOS
-- ============================================================================

-- Limpiar productos existentes para evitar duplicados
DELETE FROM products WHERE sku LIKE '%-2024' OR sku LIKE '%-2025';

-- ============================================
-- JORDAN BRAND
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
-- Air Jordan 1
('Air Jordan 1 Retro High OG - Chicago', 'air-jordan-1-chicago', 
 'El colorway más icónico del AJ1, el mismo que usó MJ en su temporada rookie',
 'Jordan', 'AJ1 Retro High OG', 'Chicago', 'AJ1-CHICAGO-2025',
 18999, 18999, 25,
 (SELECT id FROM categories WHERE slug = 'basketball'),
 '2025-01-15', TRUE, 'restock',
 ARRAY['iconic', 'grail', 'classic', 'retro'],
 ARRAY['https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600'],
 '{"38": 2, "39": 3, "40": 4, "41": 5, "42": 4, "43": 3, "44": 2, "45": 2}'::JSONB),

('Air Jordan 1 Low - Triple Black', 'air-jordan-1-low-triple-black',
 'Silhoueta low-top en negro total, perfecta para el día a día',
 'Jordan', 'AJ1 Low', 'Triple Black', 'AJ1L-TBLK-2025',
 11999, 11999, 80,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['versatile', 'daily', 'clean'],
 ARRAY['https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600'],
 '{"36": 8, "37": 10, "38": 12, "39": 15, "40": 10, "41": 8, "42": 7, "43": 5, "44": 3, "45": 2}'::JSONB),

('Air Jordan 1 Mid - Royal Blue', 'air-jordan-1-mid-royal',
 'Combinación clásica negro y azul royal en silueta mid',
 'Jordan', 'AJ1 Mid', 'Royal Blue', 'AJ1M-ROYAL-2025',
 13499, 13499, 60,
 (SELECT id FROM categories WHERE slug = 'basketball'),
 '2025-01-10', FALSE, 'standard',
 ARRAY['classic', 'royal', 'mid'],
 ARRAY['https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600'],
 '{"37": 6, "38": 8, "39": 10, "40": 12, "41": 10, "42": 8, "43": 4, "44": 2}'::JSONB),

-- Air Jordan 4
('Air Jordan 4 Retro - White Cement', 'air-jordan-4-white-cement',
 'Uno de los colorways más queridos del AJ4, cement print icónico',
 'Jordan', 'AJ4 Retro', 'White Cement', 'AJ4-WCEM-2025',
 22999, 22999, 15,
 (SELECT id FROM categories WHERE slug = 'limited-editions'),
 '2025-02-01', TRUE, 'limited',
 ARRAY['grail', 'cement', 'og', 'classic'],
 ARRAY['https://images.unsplash.com/photo-1575537302964-96cd47c06b1b?w=600'],
 '{"39": 1, "40": 2, "41": 3, "42": 3, "43": 3, "44": 2, "45": 1}'::JSONB),

('Air Jordan 4 Retro - Bred', 'air-jordan-4-bred',
 'Negro y rojo fuego, el colorway Bred legendario',
 'Jordan', 'AJ4 Retro', 'Bred', 'AJ4-BRED-2025',
 21999, 21999, 20,
 (SELECT id FROM categories WHERE slug = 'limited-editions'),
 '2025-02-15', TRUE, 'limited',
 ARRAY['bred', 'fire', 'classic', 'heat'],
 ARRAY['https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600'],
 '{"39": 2, "40": 3, "41": 4, "42": 4, "43": 3, "44": 2, "45": 2}'::JSONB),

-- Air Jordan 11
('Air Jordan 11 Retro - Concord', 'air-jordan-11-concord',
 'Patent leather y clean design, el favorito de los coleccionistas',
 'Jordan', 'AJ11 Retro', 'Concord', 'AJ11-CONC-2025',
 24999, 24999, 12,
 (SELECT id FROM categories WHERE slug = 'limited-editions'),
 '2025-12-01', TRUE, 'holiday',
 ARRAY['grail', 'holiday', 'patent', 'concord'],
 ARRAY['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600'],
 '{"40": 1, "41": 2, "42": 3, "43": 2, "44": 2, "45": 2}'::JSONB);

-- ============================================
-- NIKE
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
-- Air Force 1
('Nike Air Force 1 ''07 - Triple White', 'nike-af1-triple-white',
 'El clásico absoluto, blanco total para combinar con todo',
 'Nike', 'Air Force 1 07', 'Triple White', 'AF1-TWHT-2025',
 10999, 10999, 200,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['classic', 'essential', 'clean', 'bestseller'],
 ARRAY['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'],
 '{"36": 20, "37": 25, "38": 30, "39": 35, "40": 30, "41": 25, "42": 20, "43": 10, "44": 5}'::JSONB),

('Nike Air Force 1 ''07 - Black', 'nike-af1-black',
 'Versión total black del AF1, elegancia urbana',
 'Nike', 'Air Force 1 07', 'Black', 'AF1-BLK-2025',
 10999, 10999, 150,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['classic', 'essential', 'versatile'],
 ARRAY['https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=600'],
 '{"36": 15, "37": 20, "38": 25, "39": 30, "40": 25, "41": 20, "42": 10, "43": 5}'::JSONB),

-- Air Max
('Nike Air Max 90 - Infrared', 'nike-am90-infrared',
 'El colorway OG con el icónico infrared accent',
 'Nike', 'Air Max 90', 'Infrared', 'AM90-INF-2025',
 14999, 14999, 45,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-03-26', FALSE, 'airmax-day',
 ARRAY['og', 'infrared', 'airmax', 'classic'],
 ARRAY['https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=600'],
 '{"38": 5, "39": 8, "40": 10, "41": 8, "42": 6, "43": 4, "44": 4}'::JSONB),

('Nike Air Max 1 - Anniversary Red', 'nike-am1-anniversary',
 'El primer Air Max de la historia con el colorway original',
 'Nike', 'Air Max 1', 'Anniversary Red', 'AM1-ANNI-2025',
 15999, 15999, 35,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-03-26', FALSE, 'airmax-day',
 ARRAY['og', 'anniversary', 'tinker', 'classic'],
 ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'],
 '{"38": 3, "39": 5, "40": 8, "41": 7, "42": 5, "43": 4, "44": 3}'::JSONB),

('Nike Air Max 97 - Silver Bullet', 'nike-am97-silver-bullet',
 'Diseño futurista inspirado en los trenes bala japoneses',
 'Nike', 'Air Max 97', 'Silver Bullet', 'AM97-SLVR-2025',
 17999, 17999, 30,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-03-26', FALSE, 'airmax-day',
 ARRAY['silver', 'futuristic', 'iconic'],
 ARRAY['https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600'],
 '{"39": 4, "40": 6, "41": 6, "42": 5, "43": 5, "44": 4}'::JSONB),

-- Dunk
('Nike Dunk Low - Panda', 'nike-dunk-low-panda',
 'El colorway más viral de los últimos años, blanco y negro clean',
 'Nike', 'Dunk Low', 'Panda', 'DUNK-PANDA-2025',
 11999, 11999, 100,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-15', FALSE, 'restock',
 ARRAY['viral', 'panda', 'essential', 'trending'],
 ARRAY['https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=600'],
 '{"36": 10, "37": 15, "38": 18, "39": 20, "40": 15, "41": 10, "42": 8, "43": 4}'::JSONB),

('Nike Dunk Low - University Red', 'nike-dunk-low-uni-red',
 'Rojo universitario vibrante sobre base blanca',
 'Nike', 'Dunk Low', 'University Red', 'DUNK-URED-2025',
 11999, 11999, 70,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-02-01', FALSE, 'standard',
 ARRAY['university', 'red', 'clean'],
 ARRAY['https://images.unsplash.com/photo-1604671801908-6f0c6a092c05?w=600'],
 '{"37": 8, "38": 12, "39": 15, "40": 12, "41": 10, "42": 8, "43": 5}'::JSONB),

('Nike Dunk High - Syracuse', 'nike-dunk-high-syracuse',
 'Naranja Syracuse sobre silueta high, un clásico universitario',
 'Nike', 'Dunk High', 'Syracuse', 'DUNKH-SYR-2025',
 12999, 12999, 50,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-02-15', FALSE, 'standard',
 ARRAY['syracuse', 'orange', 'college', 'high'],
 ARRAY['https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600'],
 '{"38": 6, "39": 10, "40": 12, "41": 10, "42": 7, "43": 5}'::JSONB);

-- ============================================
-- ADIDAS
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
-- Ultraboost
('Adidas Ultraboost 23 - Core Black', 'adidas-ub23-black',
 'La mejor tecnología Boost para running, negro elegante',
 'Adidas', 'Ultraboost 23', 'Core Black', 'UB23-CBK-2025',
 18999, 18999, 60,
 (SELECT id FROM categories WHERE slug = 'running'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['boost', 'running', 'comfort', 'performance'],
 ARRAY['https://images.unsplash.com/photo-1556906781-9a412961c28c?w=600'],
 '{"38": 6, "39": 10, "40": 12, "41": 12, "42": 10, "43": 6, "44": 4}'::JSONB),

('Adidas Ultraboost 23 - Cloud White', 'adidas-ub23-white',
 'Ultraboost en blanco puro para looks limpios',
 'Adidas', 'Ultraboost 23', 'Cloud White', 'UB23-CWH-2025',
 18999, 18999, 55,
 (SELECT id FROM categories WHERE slug = 'running'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['boost', 'running', 'clean', 'white'],
 ARRAY['https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600'],
 '{"38": 5, "39": 8, "40": 12, "41": 10, "42": 10, "43": 6, "44": 4}'::JSONB),

-- Stan Smith
('Adidas Stan Smith - White Green', 'adidas-stan-smith-og',
 'El sneaker más vendido de la historia, heel tab verde',
 'Adidas', 'Stan Smith', 'White Green', 'STAN-OG-2025',
 9999, 9999, 120,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['classic', 'tennis', 'essential', 'green'],
 ARRAY['https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600'],
 '{"36": 12, "37": 15, "38": 20, "39": 25, "40": 20, "41": 15, "42": 8, "43": 5}'::JSONB),

-- Samba
('Adidas Samba OG - Black Gum', 'adidas-samba-black',
 'Indoor soccer turned street icon, gum sole clásica',
 'Adidas', 'Samba OG', 'Black Gum', 'SAMBA-BKG-2025',
 10999, 10999, 90,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-15', FALSE, 'standard',
 ARRAY['samba', 'indoor', 'gum', 'trending'],
 ARRAY['https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600'],
 '{"36": 10, "37": 12, "38": 15, "39": 18, "40": 15, "41": 10, "42": 6, "43": 4}'::JSONB),

('Adidas Samba OG - White', 'adidas-samba-white',
 'Samba en blanco con detalles negros, el nuevo it-sneaker',
 'Adidas', 'Samba OG', 'White', 'SAMBA-WHT-2025',
 10999, 10999, 85,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-15', FALSE, 'standard',
 ARRAY['samba', 'white', 'clean', 'trending'],
 ARRAY['https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600'],
 '{"36": 8, "37": 12, "38": 15, "39": 20, "40": 12, "41": 10, "42": 5, "43": 3}'::JSONB),

-- Superstar
('Adidas Superstar - Shell Toe White', 'adidas-superstar-white',
 'El shell toe original de los 70s, hip-hop heritage',
 'Adidas', 'Superstar', 'White Black', 'SS-WHT-2025',
 9999, 9999, 100,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['shelltoe', 'hiphop', 'classic', 'heritage'],
 ARRAY['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'],
 '{"36": 10, "37": 12, "38": 18, "39": 20, "40": 18, "41": 12, "42": 6, "43": 4}'::JSONB);

-- ============================================
-- YEEZY
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
('Adidas Yeezy Boost 350 V2 - Zebra', 'yeezy-350-zebra',
 'El patrón zebra más deseado de la línea 350',
 'Yeezy', 'Boost 350 V2', 'Zebra', 'YZY350-ZEB-2025',
 24999, 24999, 10,
 (SELECT id FROM categories WHERE slug = 'limited-editions'),
 '2025-03-01', TRUE, 'limited',
 ARRAY['zebra', 'hyped', 'primeknit', 'grail'],
 ARRAY['https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=600'],
 '{"39": 1, "40": 2, "41": 2, "42": 2, "43": 2, "44": 1}'::JSONB),

('Adidas Yeezy Boost 350 V2 - Onyx', 'yeezy-350-onyx',
 'Total black minimalista, el 350 más versátil',
 'Yeezy', 'Boost 350 V2', 'Onyx', 'YZY350-ONX-2025',
 22999, 22999, 18,
 (SELECT id FROM categories WHERE slug = 'limited-editions'),
 '2025-02-15', TRUE, 'restock',
 ARRAY['onyx', 'black', 'minimal', 'versatile'],
 ARRAY['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600'],
 '{"38": 2, "39": 2, "40": 3, "41": 4, "42": 3, "43": 2, "44": 2}'::JSONB),

('Adidas Yeezy Boost 700 - Wave Runner', 'yeezy-700-waverunner',
 'El diseño chunky que lo empezó todo, colores OG',
 'Yeezy', 'Boost 700', 'Wave Runner', 'YZY700-WR-2025',
 29999, 29999, 8,
 (SELECT id FROM categories WHERE slug = 'limited-editions'),
 '2025-04-01', TRUE, 'limited',
 ARRAY['waverunner', 'og', 'chunky', 'icon'],
 ARRAY['https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600'],
 '{"40": 1, "41": 2, "42": 2, "43": 2, "44": 1}'::JSONB),

('Adidas Yeezy Slide - Bone', 'yeezy-slide-bone',
 'La slide más cómoda del mercado en tono neutro',
 'Yeezy', 'Slide', 'Bone', 'YZYSLIDE-BONE-2025',
 8999, 8999, 40,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-20', FALSE, 'restock',
 ARRAY['slide', 'comfort', 'foam', 'summer'],
 ARRAY['https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600'],
 '{"38": 5, "39": 8, "40": 10, "41": 8, "42": 5, "43": 4}'::JSONB);

-- ============================================
-- NEW BALANCE
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
('New Balance 550 - White Green', 'nb-550-white-green',
 'El retro basketball que conquistó el streetwear',
 'New Balance', '550', 'White Green', 'NB550-WG-2025',
 12999, 12999, 65,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-15', FALSE, 'standard',
 ARRAY['retro', 'basketball', 'trending', 'aimeleondore'],
 ARRAY['https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600'],
 '{"37": 6, "38": 10, "39": 12, "40": 15, "41": 10, "42": 8, "43": 4}'::JSONB),

('New Balance 550 - White Navy', 'nb-550-white-navy',
 'Combinación clásica universitaria en el 550',
 'New Balance', '550', 'White Navy', 'NB550-WN-2025',
 12999, 12999, 55,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-20', FALSE, 'standard',
 ARRAY['retro', 'navy', 'preppy', 'clean'],
 ARRAY['https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600'],
 '{"37": 5, "38": 8, "39": 12, "40": 12, "41": 8, "42": 6, "43": 4}'::JSONB),

('New Balance 2002R - Protection Pack Grey', 'nb-2002r-grey',
 'Tecnología ABZORB de los 2000s con estética Y2K',
 'New Balance', '2002R', 'Protection Pack Grey', 'NB2002R-GRY-2025',
 17999, 17999, 35,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-02-01', FALSE, 'standard',
 ARRAY['2002r', 'y2k', 'dad-shoe', 'comfort'],
 ARRAY['https://images.unsplash.com/photo-1539185441755-769473a23570?w=600'],
 '{"39": 4, "40": 6, "41": 8, "42": 8, "43": 5, "44": 4}'::JSONB),

('New Balance 990v6 - Grey', 'nb-990v6-grey',
 'Made in USA, el pinnacle del confort de New Balance',
 'New Balance', '990v6', 'Grey', 'NB990V6-GRY-2025',
 22999, 22999, 25,
 (SELECT id FROM categories WHERE slug = 'running'),
 '2025-01-10', FALSE, 'standard',
 ARRAY['990', 'madeinusa', 'premium', 'dad-shoe', 'comfort'],
 ARRAY['https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600'],
 '{"40": 3, "41": 5, "42": 6, "43": 5, "44": 4, "45": 2}'::JSONB);

-- ============================================
-- PUMA
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
('Puma Suede Classic - Black White', 'puma-suede-black',
 'Un clásico del b-boy y la cultura street desde los 60s',
 'Puma', 'Suede Classic', 'Black White', 'PSUEDE-BK-2025',
 7999, 7999, 80,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['suede', 'classic', 'bboy', 'heritage'],
 ARRAY['https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600'],
 '{"37": 10, "38": 15, "39": 18, "40": 15, "41": 12, "42": 6, "43": 4}'::JSONB),

('Puma RS-X - White Multi', 'puma-rsx-multi',
 'Chunky runner con colores vibrantes de los 80s',
 'Puma', 'RS-X', 'White Multi', 'PRSX-MULTI-2025',
 11999, 11999, 45,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-02-01', FALSE, 'standard',
 ARRAY['chunky', 'retro', 'colorful', 'running'],
 ARRAY['https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600'],
 '{"38": 5, "39": 8, "40": 12, "41": 10, "42": 6, "43": 4}'::JSONB);

-- ============================================
-- CONVERSE
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
('Converse Chuck Taylor All Star Hi - Black', 'converse-chuck-hi-black',
 'El sneaker más icónico de la historia, desde 1917',
 'Converse', 'Chuck Taylor All Star Hi', 'Black', 'CHUCK-HI-BK-2025',
 6999, 6999, 150,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['classic', 'canvas', 'punk', 'rock', 'essential'],
 ARRAY['https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600'],
 '{"35": 15, "36": 20, "37": 25, "38": 30, "39": 25, "40": 20, "41": 10, "42": 5}'::JSONB),

('Converse Chuck Taylor All Star Low - White', 'converse-chuck-low-white',
 'Versión low-top en optical white, imprescindible',
 'Converse', 'Chuck Taylor All Star Low', 'Optical White', 'CHUCK-LO-WH-2025',
 6499, 6499, 180,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['classic', 'canvas', 'summer', 'essential'],
 ARRAY['https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600'],
 '{"35": 20, "36": 25, "37": 30, "38": 35, "39": 30, "40": 20, "41": 12, "42": 8}'::JSONB),

('Converse Chuck 70 Hi - Parchment', 'converse-chuck70-parchment',
 'La versión premium con mejor calidad y detalles vintage',
 'Converse', 'Chuck 70 Hi', 'Parchment', 'CHUCK70-PARCH-2025',
 8999, 8999, 60,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-15', FALSE, 'standard',
 ARRAY['premium', 'vintage', 'chuck70', 'quality'],
 ARRAY['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'],
 '{"36": 8, "37": 10, "38": 12, "39": 12, "40": 8, "41": 6, "42": 4}'::JSONB);

-- ============================================
-- VANS
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
('Vans Old Skool - Black White', 'vans-oldskool-black',
 'El side stripe más reconocible del skate',
 'Vans', 'Old Skool', 'Black White', 'VANS-OS-BK-2025',
 7499, 7499, 120,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['skate', 'sidestripe', 'classic', 'essential'],
 ARRAY['https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600'],
 '{"36": 15, "37": 18, "38": 22, "39": 25, "40": 18, "41": 12, "42": 6, "43": 4}'::JSONB),

('Vans Sk8-Hi - Black', 'vans-sk8hi-black',
 'High-top padding para protección en el skate',
 'Vans', 'Sk8-Hi', 'Black', 'VANS-SK8-BK-2025',
 8499, 8499, 90,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['skate', 'hightop', 'padded', 'protection'],
 ARRAY['https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600'],
 '{"36": 10, "37": 15, "38": 18, "39": 20, "40": 12, "41": 8, "42": 5, "43": 2}'::JSONB),

('Vans Authentic - True White', 'vans-authentic-white',
 'El original de Vans desde 1966, simplicidad pura',
 'Vans', 'Authentic', 'True White', 'VANS-AUTH-WH-2025',
 5999, 5999, 140,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-01', FALSE, 'standard',
 ARRAY['og', 'simple', 'canvas', 'summer'],
 ARRAY['https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600'],
 '{"35": 15, "36": 20, "37": 25, "38": 28, "39": 22, "40": 15, "41": 10, "42": 5}'::JSONB);

-- ============================================
-- ASICS
-- ============================================

INSERT INTO products (
  name, slug, description, brand, model, colorway, sku,
  price, original_price, stock,
  category_id, release_date, is_limited_edition, release_type,
  tags, images, sizes_available
) VALUES
('ASICS Gel-Lyte III OG - White', 'asics-gl3-white',
 'Split tongue revolucionario de 1990, confort japonés',
 'ASICS', 'Gel-Lyte III OG', 'White', 'ASICS-GL3-WH-2025',
 13999, 13999, 40,
 (SELECT id FROM categories WHERE slug = 'lifestyle'),
 '2025-01-15', FALSE, 'standard',
 ARRAY['gel', 'splittongue', 'japan', 'comfort'],
 ARRAY['https://images.unsplash.com/photo-1539185441755-769473a23570?w=600'],
 '{"38": 4, "39": 6, "40": 10, "41": 8, "42": 6, "43": 4, "44": 2}'::JSONB),

('ASICS Gel-Kayano 14 - White Silver', 'asics-kayano14-silver',
 'El runner Y2K que volvió al streetwear',
 'ASICS', 'Gel-Kayano 14', 'White Silver', 'ASICS-K14-SLV-2025',
 16999, 16999, 30,
 (SELECT id FROM categories WHERE slug = 'running'),
 '2025-02-01', FALSE, 'standard',
 ARRAY['kayano', 'y2k', 'silver', 'techwear'],
 ARRAY['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600'],
 '{"39": 3, "40": 5, "41": 8, "42": 6, "43": 5, "44": 3}'::JSONB);

-- ============================================================================
-- PASO 6: ASIGNAR BRAND_ID A PRODUCTOS
-- ============================================================================

UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'jordan') WHERE brand = 'Jordan';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'nike') WHERE brand = 'Nike';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'adidas') WHERE brand = 'Adidas';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'yeezy') WHERE brand = 'Yeezy';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'new-balance') WHERE brand = 'New Balance';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'puma') WHERE brand = 'Puma';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'converse') WHERE brand = 'Converse';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'vans') WHERE brand = 'Vans';
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'asics') WHERE brand = 'ASICS';

-- ============================================================================
-- PASO 7: ASIGNAR COLORES A PRODUCTOS
-- ============================================================================

-- Jordan productos
INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AJ1-CHICAGO-2025' AND c.slug = 'rojo'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, FALSE FROM products p, colors c 
WHERE p.sku = 'AJ1-CHICAGO-2025' AND c.slug IN ('blanco', 'negro')
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AJ1L-TBLK-2025' AND c.slug = 'negro'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AJ1M-ROYAL-2025' AND c.slug = 'azul'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, FALSE FROM products p, colors c 
WHERE p.sku = 'AJ1M-ROYAL-2025' AND c.slug = 'negro'
ON CONFLICT DO NOTHING;

-- Nike AF1
INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AF1-TWHT-2025' AND c.slug = 'blanco'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AF1-BLK-2025' AND c.slug = 'negro'
ON CONFLICT DO NOTHING;

-- Nike Dunk Panda
INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'DUNK-PANDA-2025' AND c.slug = 'blanco'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, FALSE FROM products p, colors c 
WHERE p.sku = 'DUNK-PANDA-2025' AND c.slug = 'negro'
ON CONFLICT DO NOTHING;

-- Yeezy Zebra
INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'YZY350-ZEB-2025' AND c.slug = 'blanco'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, FALSE FROM products p, colors c 
WHERE p.sku = 'YZY350-ZEB-2025' AND c.slug = 'negro'
ON CONFLICT DO NOTHING;

-- Más colores para otros productos
INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AM90-INF-2025' AND c.slug = 'rojo'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'AM97-SLVR-2025' AND c.slug = 'gris'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'DUNK-URED-2025' AND c.slug = 'rojo'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'DUNKH-SYR-2025' AND c.slug = 'naranja'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'NB550-WG-2025' AND c.slug = 'verde'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'NB550-WN-2025' AND c.slug = 'azul'
ON CONFLICT DO NOTHING;

INSERT INTO product_colors (product_id, color_id, is_primary)
SELECT p.id, c.id, TRUE FROM products p, colors c 
WHERE p.sku = 'YZY700-WR-2025' AND c.slug = 'multicolor'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PASO 8: CREAR ÍNDICES ADICIONALES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_product ON product_colors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_color ON product_colors(color_id);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_colors_slug ON colors(slug);

-- ============================================================================
-- PASO 9: HABILITAR RLS EN NUEVAS TABLAS
-- ============================================================================

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública
DROP POLICY IF EXISTS "Brands readable by all" ON brands;
CREATE POLICY "Brands readable by all"
  ON brands FOR SELECT USING (true);

DROP POLICY IF EXISTS "Colors readable by all" ON colors;
CREATE POLICY "Colors readable by all"
  ON colors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Product colors readable by all" ON product_colors;
CREATE POLICY "Product colors readable by all"
  ON product_colors FOR SELECT USING (true);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver todos los productos por marca
-- SELECT brand, COUNT(*) as total FROM products GROUP BY brand ORDER BY total DESC;

-- Ver productos por categoría
-- SELECT c.name as categoria, COUNT(*) as total FROM products p JOIN categories c ON p.category_id = c.id GROUP BY c.name;

-- Ver colores disponibles
-- SELECT * FROM colors ORDER BY display_order;

-- Ver marcas
-- SELECT * FROM brands ORDER BY display_order;

-- Contar total de productos
-- SELECT COUNT(*) as total_productos FROM products;
