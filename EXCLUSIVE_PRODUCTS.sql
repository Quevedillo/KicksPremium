-- ============================================================================
-- Productos EXCLUSIVOS y LIMITADOS para KicksPremium
-- Ejecutar en Supabase SQL Editor después de crear categorías
-- ============================================================================

-- Limpiar productos antiguos
DELETE FROM products WHERE status = 'active';

-- Insertar productos EXCLUSIVOS
INSERT INTO products (
  name,
  slug,
  description,
  price,
  original_price,
  stock,
  category_id,
  brand,
  is_limited_edition,
  status
) VALUES
-- TRAVIS SCOTT COLLECTION
(
  'Travis Scott x Air Jordan 1 Retro Low',
  'travis-scott-aj1-low',
  'Colaboración exclusiva con Travis Scott. Edición muy limitada con piel reversa y detalle de fuego. Año 2021.',
  89999, -- €899.99
  89999,
  1,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Jordan',
  true,
  'active'
),
(
  'Travis Scott x Nike SB Dunk Low',
  'travis-scott-sb-dunk',
  'Raro collab con Nike SB. Colores customizados. Solo quedan 2 pares disponibles en el mundo.',
  59999,
  59999,
  2,
  (SELECT id FROM categories WHERE slug = 'travis-scott'),
  'Nike',
  true,
  'active'
),

-- JORDAN SPECIAL EDITIONS
(
  'Air Jordan 1 Retro High OG Chicago',
  'jordan-1-chicago-og',
  'Edición original de 1985. Una de las zapatillas más icónicas. Número muy limitado disponible.',
  149999, -- €1499.99
  149999,
  1,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'active'
),
(
  'Jordan 11 Retro Space Jam',
  'jordan-11-space-jam',
  'Edición especial Space Jam. Colores personalizados únicos. Stock muy bajo.',
  79999,
  79999,
  3,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'active'
),
(
  'Air Jordan 3 Retro Black Cement',
  'jordan-3-black-cement',
  'Clásico de los 90s. Edición de coleccionista en perfecto estado.',
  69999,
  69999,
  1,
  (SELECT id FROM categories WHERE slug = 'jordan-special'),
  'Jordan',
  true,
  'active'
),

-- ADIDAS COLLABORATIONS
(
  'Adidas Yeezy 700 Wave Runner',
  'adidas-yeezy-700-wave',
  'Colaboración Kanye West con Adidas. Colores únicos en gris y azul marino.',
  99999,
  99999,
  2,
  (SELECT id FROM categories WHERE slug = 'adidas-collab'),
  'Adidas',
  true,
  'active'
),
(
  'Adidas Pharrell x NMD',
  'adidas-pharrell-nmd',
  'Edición especial Pharrell Williams. Detalles personalizados con firma. Stock extremadamente limitado.',
  44999,
  44999,
  1,
  (SELECT id FROM categories WHERE slug = 'adidas-collab'),
  'Adidas',
  true,
  'active'
),

-- EXCLUSIVE DROPS
(
  'Nike Air Max 90 Off-White',
  'nike-air-max-90-off-white',
  'Diseño Virgil Abloh. Edición limitada con componentes transparentes únicos.',
  129999,
  129999,
  1,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'Nike',
  true,
  'active'
),
(
  'New Balance 550 Aime Leon Dore',
  'nb-550-ld-dore',
  'Colaboración exclusiva Aime Leon Dore. Retro con materiales premium.',
  34999,
  34999,
  2,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'New Balance',
  true,
  'active'
),
(
  'Puma RS-X XOXO Weeknd',
  'puma-rsx-xoxo',
  'Edición especial The Weeknd. Colores únicos rojo y negro con detalles dorados.',
  24999,
  24999,
  1,
  (SELECT id FROM categories WHERE slug = 'limited-editions'),
  'Puma',
  true,
  'active'
);
