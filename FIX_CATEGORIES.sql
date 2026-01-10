-- ============================================================================
-- FIX: Cambiar a colecciones exclusivas - Sneakers Limited Edition
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- Agregar campos si no existen
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS icon VARCHAR,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Limpiar categorías viejas
DELETE FROM categories WHERE slug IN ('camisas', 'pantalones', 'trajes', 'basketball', 'lifestyle', 'running');

-- Insertar colecciones EXCLUSIVAS de sneakers
INSERT INTO categories (name, slug, description, icon, display_order) VALUES
('Travis Scott', 'travis-scott', 'Colaboraciones especiales de Travis Scott con Jordan y Nike', 'TS', 1),
('Jordan Special', 'jordan-special', 'Air Jordans de ediciones especiales y limitadas', 'JS', 2),
('Adidas Collab', 'adidas-collab', 'Colaboraciones exclusivas de Adidas con artistas reconocidos', 'AC', 3),
('Exclusive Drops', 'limited-editions', 'Ediciones limitadas, one-of-a-kind y piezas muy raras', 'EX', 4)
ON CONFLICT (slug) DO NOTHING;
