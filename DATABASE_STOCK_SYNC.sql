-- ============================================================================
-- KICKSPREMIUM - SINCRONIZACIÓN DE STOCK Y TALLAS
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- Este script asegura que el stock siempre sea la suma de las tallas disponibles
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: FUNCIÓN PARA CALCULAR STOCK TOTAL DESDE TALLAS
-- ============================================================================

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

-- ============================================================================
-- SECCIÓN 2: TRIGGER PARA SINCRONIZAR STOCK AUTOMÁTICAMENTE
-- ============================================================================

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

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN PARA OBTENER TALLAS DISPONIBLES (CON STOCK > 0)
-- ============================================================================

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

-- ============================================================================
-- SECCIÓN 4: ACTUALIZAR TODOS LOS PRODUCTOS EXISTENTES
-- ============================================================================

-- Sincronizar el stock de todos los productos existentes con sus tallas
UPDATE products
SET stock = calculate_total_stock_from_sizes(sizes_available)
WHERE sizes_available IS NOT NULL AND sizes_available != '{}'::jsonb;

-- Para productos sin tallas configuradas, establecer stock a 0
UPDATE products
SET stock = 0
WHERE sizes_available IS NULL OR sizes_available = '{}'::jsonb;

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN PARA REDUCIR STOCK DE UNA TALLA ESPECÍFICA
-- ============================================================================

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

-- ============================================================================
-- SECCIÓN 6: FUNCIÓN PARA AÑADIR STOCK A UNA TALLA
-- ============================================================================

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

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 'Funciones de sincronización de stock creadas:' as status;
SELECT proname FROM pg_proc WHERE proname IN (
  'calculate_total_stock_from_sizes', 
  'sync_stock_from_sizes', 
  'get_available_sizes',
  'reduce_size_stock',
  'add_size_stock'
);

SELECT 'Trigger creado:' as status;
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_sync_stock';

-- Mostrar productos con sus tallas y stock
SELECT name, stock, sizes_available, calculate_total_stock_from_sizes(sizes_available) as calculated_stock
FROM products
ORDER BY name
LIMIT 10;
