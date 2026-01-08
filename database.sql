-- ============================================================================
-- FashionMarket Database Schema
-- PostgreSQL + Supabase
-- ============================================================================

-- Create Enum for Product Status
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'archived');

-- ============================================================================
-- Categories Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for slug lookups
CREATE INDEX idx_categories_slug ON categories(slug);

-- ============================================================================
-- Products Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0), -- Price in cents
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status product_status DEFAULT 'active',
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], -- Array of image URLs
  sku VARCHAR(100),
  weight DECIMAL(10, 2), -- Weight in kg
  dimensions VARCHAR(100), -- e.g., "L x W x H"
  material VARCHAR(255),
  care_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- ============================================================================
-- Admin Users Table (for Supabase Auth integration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin', -- 'admin', 'editor', 'viewer'
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Categories Policies
-- ============================================================================

-- Allow public read access to all categories
CREATE POLICY "Categories: Public read access"
  ON categories
  FOR SELECT
  USING (true);

-- Allow only authenticated admins to insert/update/delete
CREATE POLICY "Categories: Admin insert"
  ON categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Categories: Admin update"
  ON categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Categories: Admin delete"
  ON categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- Products Policies
-- ============================================================================

-- Allow public read access only to active products
CREATE POLICY "Products: Public read active products"
  ON products
  FOR SELECT
  USING (status = 'active');

-- Allow admins to read all products
CREATE POLICY "Products: Admin read all"
  ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Allow only authenticated admins to insert
CREATE POLICY "Products: Admin insert"
  ON products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Allow only authenticated admins to update
CREATE POLICY "Products: Admin update"
  ON products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Allow only authenticated admins to delete
CREATE POLICY "Products: Admin delete"
  ON products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- Admin Users Policies
-- ============================================================================

-- IMPORTANT: These basic policies will be replaced by auth-setup.sql
-- The trigger needs to be able to insert, so minimal restrictions here

-- Allow authenticated admins to view admin records
CREATE POLICY "Admin users: Authenticated read"
  ON admin_users
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Allow users to update their own admin record
CREATE POLICY "Admin users: Self update"
  ON admin_users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow inserts (trigger will use this)
CREATE POLICY "Admin users: Allow insert for auth"
  ON admin_users
  FOR INSERT
  WITH CHECK (true);

-- Allow deletes only for admins
CREATE POLICY "Admin users: Admin delete"
  ON admin_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.is_active = true
    )
  );

-- ============================================================================
-- Sample Data (optional - remove in production)
-- ============================================================================

-- Insert sample categories
INSERT INTO categories (name, slug, description) VALUES
  ('Camisas', 'camisas', 'Camisas casuales y formales de alta calidad'),
  ('Pantalones', 'pantalones', 'Pantalones con cortes precisos y confortables'),
  ('Trajes', 'trajes', 'Trajes atemporales para toda ocasión')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample products
INSERT INTO products (
  name,
  slug,
  description,
  price,
  stock,
  category_id,
  images,
  material,
  sku
) VALUES
  (
    'Camisa Oxford Premium',
    'camisa-oxford-premium',
    'Camisa Oxford de algodón 100% con tejido duradero y cómodo. Perfecta para el uso diario o formal.',
    9900, -- $99.00
    15,
    (SELECT id FROM categories WHERE slug = 'camisas'),
    ARRAY['https://via.placeholder.com/500x500?text=Camisa+Oxford'],
    'Algodón 100%',
    'CSA-001'
  ),
  (
    'Pantalón Chino Versátil',
    'pantalon-chino-versatil',
    'Pantalón chino con ajuste perfecto, ideal para cualquier ocasión. Hecho con mezcla de algodón y elastano.',
    7500, -- $75.00
    22,
    (SELECT id FROM categories WHERE slug = 'pantalones'),
    ARRAY['https://via.placeholder.com/500x500?text=Pantalon+Chino'],
    'Algodón 98%, Elastano 2%',
    'PCH-001'
  ),
  (
    'Traje Gris Carbón',
    'traje-gris-carbon',
    'Traje de dos piezas en gris carbón. Confeccionado con lana premium italiana para máxima comodidad y elegancia.',
    29900, -- $299.00
    8,
    (SELECT id FROM categories WHERE slug = 'trajes'),
    ARRAY['https://via.placeholder.com/500x500?text=Traje+Gris'],
    'Lana 100%',
    'TRJ-001'
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to categories
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to admin_users
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Storage Configuration Notes (Execute in Supabase Console)
-- ============================================================================
/*
Run these SQL commands in the Supabase SQL Editor to create and configure the bucket:

1. Create the bucket:
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('products-images', 'products-images', true);

2. Create policies for the bucket:

   -- Allow public read access
   CREATE POLICY "Public read access"
     ON storage.objects
     FOR SELECT
     USING (bucket_id = 'products-images');

   -- Allow authenticated admins to upload
   CREATE POLICY "Admin upload access"
     ON storage.objects
     FOR INSERT
     WITH CHECK (
       bucket_id = 'products-images'
       AND EXISTS (
         SELECT 1 FROM admin_users
         WHERE admin_users.id = auth.uid()
         AND admin_users.is_active = true
       )
     );

   -- Allow authenticated admins to delete
   CREATE POLICY "Admin delete access"
     ON storage.objects
     FOR DELETE
     USING (
       bucket_id = 'products-images'
       AND EXISTS (
         SELECT 1 FROM admin_users
         WHERE admin_users.id = auth.uid()
         AND admin_users.is_active = true
       )
     );
*/
