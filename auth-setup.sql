-- ============================================================================
-- Supabase Auth Integration Setup - FashionMarket
-- Run this AFTER setting up database.sql
-- ============================================================================

-- ============================================================================
-- 1. CREATE PROFILES TABLE (User metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profiles: System can insert new profiles (for trigger)
CREATE POLICY "profiles_insert_system"
  ON profiles
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 2. FIX ADMIN_USERS RLS POLICIES (Critical for registration to work)
-- ============================================================================

-- Drop all existing policies on admin_users to start fresh
DROP POLICY IF EXISTS "Admin users: Public read (limited)" ON admin_users;
DROP POLICY IF EXISTS "Admin users: Admin insert" ON admin_users;
DROP POLICY IF EXISTS "Admin users: Admin update" ON admin_users;
DROP POLICY IF EXISTS "Admin users: Admin delete" ON admin_users;
DROP POLICY IF EXISTS "Admin users: System can insert admins" ON admin_users;
DROP POLICY IF EXISTS "Admin users: Authenticated users can verify admin status" ON admin_users;
DROP POLICY IF EXISTS "Admin users: Authenticated read own record" ON admin_users;
DROP POLICY IF EXISTS "Admin users: User insert own" ON admin_users;
DROP POLICY IF EXISTS "Admin users: Admin update own" ON admin_users;

-- Policy 1: System (trigger) can insert admin records
CREATE POLICY "admin_insert_system"
  ON admin_users
  FOR INSERT
  WITH CHECK (true);

-- Policy 2: Users can view their own admin record if they are admin
CREATE POLICY "admin_select_own"
  ON admin_users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 3: Admins can view all admin records
CREATE POLICY "admin_select_all_admins"
  ON admin_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Policy 4: Users can update their own admin record
CREATE POLICY "admin_update_own"
  ON admin_users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 5: Admins can update any admin record
CREATE POLICY "admin_update_all_admins"
  ON admin_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- 3. TRIGGER FUNCTION - Auto-create admin on registration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  admin_email VARCHAR(255) := 'joseluisgq17@gmail.com';
  user_full_name VARCHAR(255);
BEGIN
  -- Get full_name from auth metadata or default
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario');

  -- 1. Create profile entry for the new user
  INSERT INTO profiles (id, email, full_name)
  VALUES (new.id, new.email, user_full_name)
  ON CONFLICT (id) DO NOTHING;

  -- 2. If email matches admin email, create admin record
  IF new.email = admin_email THEN
    INSERT INTO admin_users (id, email, full_name, role, is_active)
    VALUES (
      new.id,
      new.email,
      user_full_name,
      'admin',
      true
    )
    ON CONFLICT (email) DO UPDATE
    SET is_active = true, role = 'admin';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. SAMPLE DATA (Optional - delete if not needed)
-- ============================================================================

-- Insert sample categories if they don't exist
INSERT INTO categories (name, slug, description) VALUES
('Camisas', 'camisas', 'Camisas premium para hombre'),
('Pantalones', 'pantalones', 'Pantalones de calidad'),
('Trajes', 'trajes', 'Trajes formales')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample products if they don't exist
INSERT INTO products (name, slug, description, price, stock, status, category_id, sku) VALUES
(
  'Camisa Oxford Premium',
  'camisa-oxford-premium',
  'Camisa Oxford de algodón 100% con acabado premium',
  9900,
  50,
  'active',
  (SELECT id FROM categories WHERE slug = 'camisas'),
  'SHIRT-001'
),
(
  'Pantalón Chino Versátil',
  'pantalon-chino-versatil',
  'Pantalón chino de algodón con acabado versátil',
  7500,
  30,
  'active',
  (SELECT id FROM categories WHERE slug = 'pantalones'),
  'PANT-001'
),
(
  'Traje Gris Carbón',
  'traje-gris-carbon',
  'Traje gris carbón con tela premium',
  29900,
  20,
  'active',
  (SELECT id FROM categories WHERE slug = 'trajes'),
  'SUIT-001'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 5. SETUP INSTRUCTIONS
-- ============================================================================

-- INSTRUCTIONS FOR SETUP:
-- 
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Execute database.sql FIRST (if not done yet)
-- 3. Execute THIS FILE (auth-setup.sql)
-- 4. Go to http://localhost:3000/auth/login
-- 5. Click "Registrarse" (Register)
-- 6. Fill in:
--    - Nombre: Your name
--    - Email: joseluisgq17@gmail.com (THIS IS IMPORTANT!)
--    - Contraseña: Your password (min 6 chars)
-- 7. Click "Crear Cuenta"
-- 8. You should now be registered as a regular user AND as admin
-- 9. Go to http://localhost:3000/admin/login
-- 10. Login with:
--    - Email: joseluisgq17@gmail.com
--    - Password: Your password
-- 11. You should have full admin access!
--
-- If you get errors, check Supabase logs for details.
