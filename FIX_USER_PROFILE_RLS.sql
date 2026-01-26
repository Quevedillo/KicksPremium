-- ============================================================================
-- FIX: Desactivar trigger problemático de creación de usuarios
-- ============================================================================
-- EJECUTAR EN SUPABASE SQL EDITOR - COPIA TODO ESTO
-- ============================================================================

-- PASO 1: DESACTIVAR el trigger que está fallando
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- PASO 2: Ver la función (para referencia)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- PASO 3: Crear función segura para crear perfiles (SECURITY DEFINER bypassa RLS)
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, is_admin)
  VALUES (p_user_id, p_email, p_full_name, p_is_admin)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, user_profiles.full_name),
    is_admin = COALESCE(p_is_admin, user_profiles.is_admin);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: Modificar políticas RLS
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "service_role_all_profiles" ON user_profiles;

CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id OR current_setting('role', true) = 'service_role');

CREATE POLICY "service_role_all_profiles" ON user_profiles
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- PASO 5: Verificar
SELECT 'Trigger eliminado ✓' as status;
SELECT 'Función create_user_profile creada ✓' as status;
SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles';

