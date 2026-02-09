-- ============================================================================
-- KICKSPREMIUM - MIGRACIÓN: VIP ACCESS + PAGE CUSTOMIZER
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: SISTEMA VIP ACCESS
-- ============================================================================

-- TABLA: vip_subscriptions (Suscripciones VIP)
CREATE TABLE IF NOT EXISTS vip_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, cancelled, past_due, expired
  plan_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual
  price_cents INTEGER NOT NULL DEFAULT 999, -- 9.99€/mes por defecto
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vip_user_id ON vip_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_email ON vip_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_vip_status ON vip_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_vip_stripe_sub ON vip_subscriptions(stripe_subscription_id);

-- RLS
ALTER TABLE vip_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_vip" ON vip_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_manage_vip" ON vip_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- TABLA: vip_notifications (Notificaciones para VIPs)
CREATE TABLE IF NOT EXISTS vip_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'new_product', 'restock', 'vip_discount'
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_notif_type ON vip_notifications(type);
CREATE INDEX IF NOT EXISTS idx_vip_notif_created ON vip_notifications(created_at DESC);

ALTER TABLE vip_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_manage_vip_notif" ON vip_notifications
  FOR ALL USING (true) WITH CHECK (true);

-- TABLA: vip_notification_reads (Qué notificaciones ha leído cada VIP)
CREATE TABLE IF NOT EXISTS vip_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES vip_notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE vip_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reads" ON vip_notification_reads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_manage_reads" ON vip_notification_reads
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- SECCIÓN 2: PAGE CUSTOMIZER (Personalización de página)
-- ============================================================================

-- TABLA: page_sections (Secciones de la página principal)
CREATE TABLE IF NOT EXISTS page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_type TEXT NOT NULL, -- 'hero', 'featured_products', 'categories', 'banner', 'brands', 'newsletter', 'custom_products'
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}', -- Contenido flexible según tipo
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}', -- Estilos, colores, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_sections_order ON page_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_page_sections_visible ON page_sections(is_visible);

ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_sections" ON page_sections
  FOR SELECT USING (true);

CREATE POLICY "admins_manage_sections" ON page_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );

CREATE POLICY "service_manage_sections" ON page_sections
  FOR ALL USING (true) WITH CHECK (true);

-- TABLA: featured_product_selections (Productos seleccionados para secciones)
CREATE TABLE IF NOT EXISTS featured_product_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES page_sections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, product_id)
);

ALTER TABLE featured_product_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_featured" ON featured_product_selections
  FOR SELECT USING (true);
CREATE POLICY "admins_manage_featured" ON featured_product_selections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );
CREATE POLICY "service_manage_featured" ON featured_product_selections
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at en page_sections
CREATE OR REPLACE FUNCTION update_page_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_page_sections_updated_at ON page_sections;
CREATE TRIGGER trigger_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_page_sections_updated_at();

-- ============================================================================
-- SECCIÓN 3: DATOS INICIALES
-- ============================================================================

-- Secciones iniciales de la página
INSERT INTO page_sections (section_type, title, subtitle, display_order, is_visible, content, settings) VALUES
('hero', 'SNEAKERS EXCLUSIVOS & LIMITADOS', 'Colaboraciones especiales, ediciones limitadas y piezas únicas. Travis Scott • Jordan Special • Adidas Collab • Nike Rare', 1, true, 
  '{"cta_primary": {"text": "Explorar Colección", "url": "/productos"}, "cta_secondary": {"text": "Ediciones Limitadas", "url": "/categoria/limited-editions"}, "badge": "Exclusively Limited"}'::jsonb,
  '{"bg_color": "brand-black", "text_color": "white"}'::jsonb),
('brands_bar', 'Marcas', null, 2, true,
  '{"brands": ["Travis Scott", "Jordan Special", "Adidas Collab", "Nike Rare", "Yeezy SZN"]}'::jsonb,
  '{}'::jsonb),
('categories', 'Colecciones', 'Piezas exclusivas y únicamente disponibles', 3, true,
  '{}'::jsonb,
  '{"columns": 4}'::jsonb),
('featured_products', 'Destacados', 'Hot Right Now', 4, true,
  '{"max_products": 6}'::jsonb,
  '{"columns": 3}'::jsonb),
('vip_access', 'VIP ACCESS', 'Acceso exclusivo a drops, descuentos especiales y notificaciones prioritarias', 5, true,
  '{"monthly_price": 999, "benefits": ["Descuentos exclusivos VIP (15%)", "Notificaciones de nuevos productos", "Acceso anticipado a drops", "Alertas de restock"]}'::jsonb,
  '{"bg_color": "brand-black"}'::jsonb),
('newsletter', 'No te pierdas ningún drop', 'Únete a nuestra lista y sé el primero en enterarte de los nuevos lanzamientos y ofertas exclusivas.', 6, true,
  '{}'::jsonb,
  '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- Código de descuento VIP (15% permanente)
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_uses_per_user, max_uses)
VALUES ('VIP15', 'Descuento exclusivo para miembros VIP - 15%', 'percentage', 15, 0, 999, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
SELECT '✅ Migración VIP + Page Customizer completada' as status;
