-- ============================================================================
-- CONFIGURACIÓN DE USUARIO ADMIN - joseluisgq17@gmail.com
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================================

-- OPCIÓN 1: Si ya se registró y necesita permisos
-- (Ejecuta esto si el usuario ya hizo registro normal en /auth/login)
UPDATE user_profiles 
SET is_admin = true 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'joseluisgq17@gmail.com'
);

-- Verificar que se actualizó correctamente
SELECT 
  up.id,
  au.email,
  up.full_name,
  up.is_admin,
  up.created_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE au.email = 'joseluisgq17@gmail.com'
LIMIT 1;

-- ============================================================================
-- OPCIÓN 2: Crear trigger para futuros registros
-- (Ejecuta esto UNA SOLA VEZ para que todos los registros con ese email sean admin automáticamente)
-- ============================================================================

-- Eliminar el trigger antiguo si existe
DROP TRIGGER IF EXISTS on_user_profile_created_admin ON user_profiles;

-- Crear función que asigna admin automáticamente
CREATE OR REPLACE FUNCTION assign_admin_for_specific_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Asignar admin si el email coincide
  IF (SELECT email FROM auth.users WHERE id = NEW.id LIMIT 1) = 'joseluisgq17@gmail.com' THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger BEFORE INSERT en user_profiles
CREATE TRIGGER on_user_profile_created_admin
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_admin_for_specific_email();

-- Verificar que el trigger se creó correctamente
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'on_user_profile_created_admin';

-- ============================================================================
-- PRUEBA: Después de ejecutar esto, intenta registrarte con joseluisgq17@gmail.com
-- El usuario debería ser creado como admin automáticamente
-- ============================================================================
