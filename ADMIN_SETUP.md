# Configuración de Usuario Admin

Para configurar el usuario **joseluisgq17@gmail.com** como administrador, sigue estos pasos:

## 1. Primero, el usuario debe registrarse

El usuario debe registrarse en la tienda a través de `/auth/login` usando el email `joseluisgq17@gmail.com`.

## 2. Ejecutar SQL para dar permisos de admin

Después del registro, ejecuta este SQL en **Supabase SQL Editor** (Dashboard > SQL Editor > New Query):

```sql
-- Hacer admin al usuario con email joseluisgq17@gmail.com
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
  up.is_admin
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE au.email = 'joseluisgq17@gmail.com';
```

## 3. Acceder al panel de admin

Una vez configurado, el usuario puede acceder a:
- **Panel de Admin**: `/admin`
- **Dashboard**: `/admin` (página principal)
- **Productos**: `/admin/productos`
- **Pedidos**: `/admin/pedidos`
- **Categorías**: `/admin/categorias`
- **Usuarios**: `/admin/usuarios`
- **Configuración**: `/admin/configuracion`

## Alternativa: Trigger automático para asignar admin

Si el usuario aún no se ha registrado, crea este trigger que automáticamente le da admin basándose en el email:

```sql
-- Primero, eliminar el trigger antiguo si existe
DROP TRIGGER IF EXISTS on_user_profile_created_admin ON user_profiles;

-- Crear función que se dispara cuando se crea un perfil de usuario
CREATE OR REPLACE FUNCTION assign_admin_for_specific_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el email es el del admin
  IF (SELECT email FROM auth.users WHERE id = NEW.id) = 'joseluisgq17@gmail.com' THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger en user_profiles (en lugar de auth.users)
CREATE TRIGGER on_user_profile_created_admin
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_admin_for_specific_email();
```

**Si sigue dando error**, ejecuta esta solución más simple y directa:

```sql
-- Solución alternativa: Crear un usuario admin manualmente

-- 1. Primero, ejecuta esto en el SQL Editor de Supabase
-- Reemplaza los valores entre comillas con los datos reales

INSERT INTO auth.users (id, email, raw_user_meta_data, user_metadata)
VALUES (
  gen_random_uuid(),
  'joseluisgq17@gmail.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Administrador"}'
)
ON CONFLICT (email) DO NOTHING;

-- 2. Luego, luego que se registre normalmente, ejecuta este para darle permisos
UPDATE user_profiles 
SET is_admin = true 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'joseluisgq17@gmail.com'
);
```

## Estructura del Panel de Admin

El panel de administración incluye:

### Dashboard (`/admin`)
- Estadísticas en tiempo real (productos, pedidos, ingresos, categorías)
- Pedidos recientes
- Alertas de stock bajo
- Acciones rápidas

### Productos (`/admin/productos`)
- Lista de todos los productos con filtros
- Crear nuevo producto con Cloudinary
- Editar productos existentes
- Eliminar productos

### Pedidos (`/admin/pedidos`)
- Lista de pedidos con filtros por estado
- Ver detalles del pedido
- Actualizar estado del pedido

### Categorías (`/admin/categorias`)
- CRUD completo de categorías
- Ver cantidad de productos por categoría

### Usuarios (`/admin/usuarios`)
- Lista de usuarios registrados
- Gestionar permisos de admin
- Activar/desactivar usuarios

### Configuración (`/admin/configuracion`)
- Información del perfil admin
- Estado de integraciones (Stripe, Cloudinary, Supabase)
- Acciones rápidas
