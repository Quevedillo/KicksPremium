-- ============================================================================
-- MIGRACIÓN: Sistema de descuentos + Limpieza de categorías/colecciones
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Añadir columnas de descuento a productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_type VARCHAR DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN products.discount_type IS 'Tipo de descuento: percentage (%) o fixed (€)';
COMMENT ON COLUMN products.discount_value IS 'Valor del descuento: porcentaje (1-100) o cantidad fija en EUR';

-- 2. Índice para buscar productos con descuento (colección Ofertas)
CREATE INDEX IF NOT EXISTS idx_products_discount ON products(discount_type) WHERE discount_type IS NOT NULL;

-- 3. Eliminar categorías que se superponen con colecciones
-- "Limited Editions" y "Sale" pasan a ser colecciones, no categorías
-- Primero mover productos de esas categorías a "Exclusive Drops" o "All Kicks"
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'exclusive-drops' LIMIT 1)
WHERE category_id IN (SELECT id FROM categories WHERE slug IN ('limited-editions', 'sale'))
AND category_id IS NOT NULL;

-- Ahora eliminar las categorías duplicadas
DELETE FROM categories WHERE slug IN ('limited-editions', 'new-releases', 'sale');

-- 4. Actualizar orden de categorías restantes
UPDATE categories SET display_order = 1 WHERE slug = 'all-kicks';
UPDATE categories SET display_order = 2 WHERE slug = 'travis-scott';
UPDATE categories SET display_order = 3 WHERE slug = 'jordan-special';
UPDATE categories SET display_order = 4 WHERE slug = 'exclusive-drops';
UPDATE categories SET display_order = 5 WHERE slug = 'retro-classics';

-- 5. Verificación
SELECT slug, name, display_order FROM categories ORDER BY display_order;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'products' AND column_name IN ('discount_type', 'discount_value');
