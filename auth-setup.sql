-- ============================================================================
-- Supabase Auth Integration Setup
-- Run this AFTER setting up database.sql
-- ============================================================================

-- Add profiles table for user metadata
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Create Admin Users (Run after creating your first user in Supabase Auth)
-- ============================================================================

-- Example: To create an admin, first:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" and create an account
-- 3. Copy the user ID (UUID) and replace YOUR_USER_ID below
-- 4. Run this insert:

-- INSERT INTO admin_users (id, email, full_name, role, is_active)
-- VALUES (
--   'YOUR_USER_ID',
--   'admin@fashionmarket.com',
--   'Admin User',
--   'admin',
--   true
-- );

-- ============================================================================
-- Update existing RLS policies for admin_users to support auth
-- ============================================================================

-- Allow authenticated users to read admin_users (for verification)
DROP POLICY IF EXISTS "Admin users: Public read (limited)" ON admin_users;

CREATE POLICY "Admin users: Authenticated users can verify admin status"
  ON admin_users
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      -- Users can see their own admin record
      id = auth.uid()
      -- OR admins can see all admin records
      OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.is_active = true
      )
    )
  );

-- Admin can insert new admins
DROP POLICY IF EXISTS "Admin users: Admin insert" ON admin_users;

CREATE POLICY "Admin users: Admin insert"
  ON admin_users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.role = 'admin'
    )
  );

-- Admin can update admin records
DROP POLICY IF EXISTS "Admin users: Admin update" ON admin_users;

CREATE POLICY "Admin users: Admin update"
  ON admin_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
      AND admin_users.role = 'admin'
    )
  );

-- ============================================================================
-- Trigger to create profile entry when user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- Notes for Admin Account Creation
-- ============================================================================
-- 
-- After deployment:
-- 1. Create first admin user in Supabase Auth UI
-- 2. Get the UUID of that user
-- 3. Insert into admin_users table with that UUID
-- 4. Set role='admin' and is_active=true
--
-- Example SQL (after getting UUID from step 2):
-- INSERT INTO admin_users (id, email, full_name, role, is_active)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'admin@email.com', 'Admin', 'admin', true);
