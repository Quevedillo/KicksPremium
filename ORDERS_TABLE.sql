-- ============================================================================
-- TABLA DE PEDIDOS (ORDERS) PARA SINCRONIZACIÓN CON STRIPE
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase
-- Dashboard > SQL Editor > New Query
-- ============================================================================

-- Crear tabla de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  shipping_name TEXT,
  shipping_address JSONB,
  shipping_phone TEXT,
  billing_email TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Trigger para actualizar updated_at automáticamente
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
-- POLÍTICAS RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver solo sus propios pedidos
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuarios pueden insertar sus propios pedidos
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuarios pueden actualizar sus propios pedidos (para cancelar)
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: service role tiene acceso total (para webhooks y admin)
DROP POLICY IF EXISTS "Service role full access" ON orders;
CREATE POLICY "Service role full access" ON orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que la tabla existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'orders'
) AS orders_table_exists;

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'orders';

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON TABLE orders IS 'Pedidos sincronizados con Stripe Checkout';
COMMENT ON COLUMN orders.user_id IS 'ID del usuario de Supabase Auth';
COMMENT ON COLUMN orders.stripe_session_id IS 'ID único de la sesión de Stripe Checkout';
COMMENT ON COLUMN orders.items IS 'JSON con los productos del pedido';
COMMENT ON COLUMN orders.total_amount IS 'Monto total en dólares (no cents)';
