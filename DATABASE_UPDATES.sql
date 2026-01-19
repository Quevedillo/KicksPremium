-- ============================================================================
-- KICKSPREMIUM - ACTUALIZACIONES BD: DESCUENTOS Y GESTIÓN POST-VENTA
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: TABLA DE CÓDIGOS DE DESCUENTO
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

-- ============================================================================
-- SECCIÓN 2: TABLA DE USO DE CÓDIGOS (TRACKING)
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

-- ============================================================================
-- SECCIÓN 3: ACTUALIZAR TABLA ORDERS CON NUEVOS ESTADOS Y CAMPOS
-- ============================================================================

-- Agregar columnas para descuentos y estados mejorados
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id),
ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal_amount INTEGER,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_status VARCHAR(50); -- 'requested', 'approved', 'received', 'refunded'

-- Índice para estado
CREATE INDEX IF NOT EXISTS idx_orders_status_v2 ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);

-- ============================================================================
-- SECCIÓN 4: FUNCIÓN PARA CANCELAR PEDIDO (TRANSACCIÓN ATÓMICA)
-- ============================================================================

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

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN PARA VALIDAR Y APLICAR CÓDIGO DE DESCUENTO
-- ============================================================================

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

-- ============================================================================
-- SECCIÓN 6: FUNCIÓN PARA SOLICITAR DEVOLUCIÓN
-- ============================================================================

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
  IF v_order.return_status IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe una solicitud de devolución para este pedido');
  END IF;
  
  -- 4. Crear solicitud
  UPDATE orders
  SET return_status = 'requested',
      return_requested_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitud de devolución registrada',
    'order_id', p_order_id
  );
END;
$$;

-- ============================================================================
-- SECCIÓN 7: CÓDIGOS DE DESCUENTO INICIALES
-- ============================================================================

-- Código de bienvenida para newsletter (10% descuento)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user)
VALUES ('WELCOME10', 'Descuento de bienvenida - 10% en tu primera compra', 'percentage', 10, 5000, 1)
ON CONFLICT (code) DO NOTHING;

-- Código de envío gratis (descuento fijo de 5.99€)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase)
VALUES ('FREESHIP', 'Envío gratis en pedidos superiores a 100€', 'fixed', 599, 10000)
ON CONFLICT (code) DO NOTHING;

-- Código VIP 20%
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses)
VALUES ('VIP20', 'Descuento VIP - 20% en toda la tienda', 'percentage', 20, 0, 100)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 'Tablas y funciones de descuentos creadas:' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('discount_codes', 'discount_code_uses');
SELECT proname FROM pg_proc WHERE proname IN ('cancel_order_atomic', 'validate_discount_code', 'request_return');
