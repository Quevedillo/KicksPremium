-- ============================================================================
-- FIX: Crear categorías de sneakers correctas
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- Agregar campos si no existen
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS icon VARCHAR,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Limpiar categorías viejas
DELETE FROM categories WHERE slug IN ('camisas', 'pantalones', 'trajes');

-- Insertar categorías de sneakers
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
('Basketball', 'basketball', 'Zapatos de baloncesto: Jordan, Kyrie, LeBron y más', 'B', 1),
('Lifestyle', 'lifestyle', 'Sneakers casuales para el día a día: Air Force, Stan Smith, etc.', 'L', 2),
('Running', 'running', 'Zapatillas para correr: Air Max, Ultraboost, Gel-Lyte', 'R', 3),
('Limited Editions', 'limited-editions', 'Ediciones limitadas y colaboraciones exclusivas', 'LE', 4)
ON CONFLICT (slug) DO NOTHING;
