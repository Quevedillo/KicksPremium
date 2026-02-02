-- ============================================================================
-- ACTUALIZACIÓN DE CATEGORÍAS - KICKS PREMIUM
-- ============================================================================
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Actualiza las categorías eliminando "Estilo" y mejorando opciones
-- ============================================================================

-- 1. Mantener solo Exclusive Drops de las categorías actuales
-- Y añadir mejores categorías basadas en colaboraciones reales

-- Eliminar categorías antiguas que se solapan con "marca"
DELETE FROM categories WHERE slug IN (
  'travis-scott',
  'jordan-special', 
  'adidas-collab'
);

-- Actualizar o insertar categorías mejoradas (colecciones por tipo, no por marca)
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
-- Mantener Exclusive Drops
('Exclusive Drops', 'limited-editions', 'Lanzamientos exclusivos, one-of-a-kind y piezas ultra raras', '💎', 1),

-- Nuevas categorías por tipo de colección
('Retro Classics', 'retro-classics', 'Reediciones de modelos icónicos de los 80s y 90s', '👟', 2),
('High Tops', 'high-tops', 'Sneakers de caña alta para un look urbano', '🔝', 3),
('Low Tops', 'low-tops', 'Sneakers de caña baja, versatilidad máxima', '⬇️', 4),
('Collabs', 'collabs', 'Colaboraciones con artistas, diseñadores y marcas', '🤝', 5),
('Performance', 'performance', 'Sneakers diseñados para rendimiento deportivo', '🏃', 6),
('Lifestyle', 'lifestyle', 'Sneakers casuales para el día a día', '🌆', 7)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

-- 2. Crear tabla de brands si no existe (para filtro de marcas)
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

-- 3. Crear tabla de colors si no existe (para filtro de colores)
CREATE TABLE IF NOT EXISTS colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  slug VARCHAR NOT NULL UNIQUE,
  hex VARCHAR(50),
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Añadir columna slug si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'colors' AND column_name = 'slug'
  ) THEN
    ALTER TABLE colors ADD COLUMN slug VARCHAR NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT;
  END IF;
END $$;

-- Añadir columna hex_code si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'colors' AND column_name = 'hex_code'
  ) THEN
    ALTER TABLE colors ADD COLUMN hex_code VARCHAR(50) NOT NULL DEFAULT '#000000';
  END IF;
END $$;

-- Aumentar tamaño de columna hex_code si existe pero es muy pequeña
DO $$
BEGIN
  ALTER TABLE colors ALTER COLUMN hex_code TYPE VARCHAR(50);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

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

-- 4. Añadir columna color a products si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'color'
  ) THEN
    ALTER TABLE products ADD COLUMN color VARCHAR;
  END IF;
END $$;

-- 5. Añadir columna is_featured a products si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 6. Verificación
SELECT 'Categorías actualizadas:' as info;
SELECT name, slug, icon, display_order FROM categories ORDER BY display_order;

SELECT 'Marcas disponibles:' as info;
SELECT name, is_featured FROM brands WHERE is_featured = true ORDER BY display_order;

SELECT 'Colores disponibles:' as info;
SELECT name, hex_code FROM colors ORDER BY display_order;

-- ============================================================================
-- FIN DE ACTUALIZACIÓN
-- ============================================================================
