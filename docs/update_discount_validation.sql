-- ============================================================================
-- ACTUALIZACIÓN: Validación mejorada de códigos de descuento de primera compra
-- ============================================================================
-- Este script actualiza la función validate_discount_code para verificar que
-- los códigos WELCOME10 y PRIMERA_COMPRA solo se pueden usar en la primera compra

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
  v_user_orders INTEGER;
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
  
  -- 2. VALIDACIÓN ESPECIAL: Si es código de primera compra, verificar que el usuario no haya comprado
  IF v_discount.code IN ('WELCOME10', 'PRIMERA_COMPRA') AND p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_orders
    FROM orders
    WHERE user_id = p_user_id AND status IN ('completed', 'pending', 'processing', 'shipped');
    
    IF v_user_orders > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Este código solo es válido para tu primera compra');
    END IF;
  END IF;
  
  -- 3. Verificar usos máximos globales
  IF v_discount.max_uses IS NOT NULL AND v_discount.current_uses >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;
  
  -- 4. Verificar usos por usuario
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
    FROM discount_code_uses
    WHERE code_id = v_discount.id AND user_id = p_user_id;
    
    IF v_user_uses >= v_discount.max_uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Ya has usado este código');
    END IF;
  END IF;
  
  -- 5. Verificar compra mínima
  IF p_cart_total < v_discount.min_purchase THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Compra mínima requerida: €' || (v_discount.min_purchase / 100.0)::TEXT
    );
  END IF;
  
  -- 6. Calcular descuento
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

-- Confirmación
SELECT '✅ Función validate_discount_code actualizada correctamente' as resultado;
