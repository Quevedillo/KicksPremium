# 💳 Configuración de Stripe - Pasarela de Pago

## Resumen

La tienda ahora incluye integración completa con **Stripe Checkout** para procesar pagos de forma segura.

---

## 📋 Pasos de Configuración

### 1. Crear cuenta en Stripe

1. Ve a [https://stripe.com](https://stripe.com)
2. Crea una cuenta gratuita
3. Completa la verificación básica

### 2. Obtener claves de API

1. Inicia sesión en el [Dashboard de Stripe](https://dashboard.stripe.com)
2. Asegúrate de estar en **modo TEST** (interruptor en la esquina superior derecha)
3. Ve a **Developers > API Keys**
4. Copia las claves:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### 3. Configurar variables de entorno

Edita tu archivo `.env` y añade:

```env
# Stripe
PUBLIC_STRIPE_PUBLIC_KEY=pk_test_tu_clave_publica_aqui
STRIPE_SECRET_KEY=sk_test_tu_clave_secreta_aqui
```

### 4. Reiniciar el servidor

```bash
npm run dev
```

---

## 🛒 Flujo de Pago

1. **Usuario añade productos al carrito**
2. **Click en "Pagar con Stripe"** en el carrito
3. **Redirección a Stripe Checkout** con los productos
4. **Usuario completa el pago** (tarjeta, dirección, etc.)
5. **Redirección de vuelta**:
   - ✅ **Éxito**: `/checkout/success` - Pedido confirmado
   - ❌ **Cancelado**: `/checkout/cancel` - Carrito intacto

---

## 📁 Archivos Creados

```
src/
├── lib/
│   └── stripe.ts              # Cliente de Stripe server-side
├── pages/
│   ├── api/
│   │   └── checkout/
│   │       └── create-session.ts   # API para crear sesión de pago
│   └── checkout/
│       ├── success.astro      # Página de éxito
│       └── cancel.astro       # Página de cancelación
└── components/
    └── islands/
        └── CartSlideOver.tsx  # Actualizado con botón de pago
```

---

## 💳 Tarjetas de Prueba

En modo TEST, usa estas tarjetas para probar:

| Número | Descripción |
|--------|-------------|
| `4242 4242 4242 4242` | Pago exitoso |
| `4000 0000 0000 0002` | Tarjeta rechazada |
| `4000 0000 0000 3220` | Requiere autenticación 3D Secure |

**Datos adicionales:**
- Fecha de expiración: Cualquier fecha futura (ej: `12/34`)
- CVC: Cualquier 3 dígitos (ej: `123`)
- ZIP: Cualquier código postal (ej: `12345`)

## 🌍 Países Habilitados

Actualmente los envíos están configurados para:
- 🇺🇸 Estados Unidos
- 🇲🇽 México
- 🇪🇸 España
- 🇦🇷 Argentina
- 🇨🇴 Colombia
- 🇨🇱 Chile
- 🇵🇪 Perú

Para modificar, edita `src/pages/api/checkout/create-session.ts`:

```typescript
shipping_address_collection: {
  allowed_countries: ['US', 'MX', 'ES', ...],
},
```

---

## 📡 Webhooks - Sincronización de Pedidos

### ¿Qué es un webhook?

Un webhook es una notificación que Stripe envía a tu servidor cuando ocurre un evento (ej: pago completado). Esto permite sincronizar automáticamente los pedidos en tu BD.

### Configurar Webhooks

1. Ve a [Dashboard de Stripe > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click en "Agregar endpoint"
3. Ingresa tu URL (debe ser público):
   ```
   https://tudominio.com/api/webhooks/stripe
   ```
   
   Para LOCAL testing usa [ngrok](https://ngrok.com):
   ```bash
   ngrok http 4322
   https://abc123.ngrok.io/api/webhooks/stripe
   ```

4. Selecciona eventos:
   - `checkout.session.completed` ✅ (Pago completado)
   - `payment_intent.payment_failed` ❌ (Pago fallido)

5. Click en "Agregar evento"

6. Obtén el "Signing secret" y agrégalo a `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Eventos Manejados

#### ✅ checkout.session.completed
- Se dispara cuando el usuario completa el pago
- Crea un nuevo registro en la tabla `orders`
- Sincroniza los productos, direcciones y datos del cliente

#### ❌ payment_intent.payment_failed
- Se dispara cuando el pago falla
- Registra la orden fallida para auditoría

---

## 🔄 Sincronización Manual de Pedidos

Si tienes pedidos en Stripe que no se sincronizaron automáticamente:

### Opción 1: Sincronizar vía API

```bash
curl -X POST http://localhost:4322/api/sync/stripe-orders \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "✅ Sincronización completada: 5 pedidos sincronizados, 2 omitidos",
  "synced": 5,
  "skipped": 2,
  "errors": []
}
```

### Opción 2: Sincronizar desde la BD

Puedes ejecutar directamente en Supabase:

```sql
-- Ver sesiones de Stripe completadas
SELECT id, amount_total, customer_email, metadata 
FROM stripe_checkout_sessions 
WHERE payment_status = 'paid'
ORDER BY created DESC
LIMIT 20;
```

---

## 📊 Estructura de la tabla `orders`

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  total_amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending',
  shipping_name TEXT,
  shipping_address JSONB,
  shipping_phone TEXT,
  billing_email TEXT,
  items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Campos importantes:

- `user_id`: Relación con el usuario autenticado
- `stripe_session_id`: ID único de la sesión de Stripe
- `total_amount`: Monto en dólares (no en cents)
- `status`: `completed`, `pending`, `failed`, `cancelled`
- `items`: Array JSON con detalles de productos
- `shipping_address`: JSONB con datos de envío

---

## 🧪 Testing Local

### Sin webhook secret (DEV)

El endpoint `/api/webhooks/stripe` funciona sin secret en desarrollo:

```bash
curl -X POST http://localhost:4322/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_123",
        "amount_total": 9999,
        "customer_email": "user@example.com",
        "shipping_details": {
          "name": "Juan Pérez",
          "address": {"line1": "Calle 1", "city": "CDMX"}
        },
        "metadata": {
          "user_id": "user-123",
          "cart_items": "[{...}]"
        }
      }
    }
  }'
```

---

## ❓ Verificar sincronización

1. Completa un pago con tarjeta `4242 4242 4242 4242`
2. Ve a [Stripe Dashboard > Payments](https://dashboard.stripe.com/payments)
3. Busca tu sesión y verifica que esté "Paid"
4. Ve a `/pedidos` en tu app
5. Deberías ver el pedido listado

---

## 🚀 Producción

Cuando despliegues a producción:

1. Actualiza URLs en `.env`:
   ```env
   PUBLIC_STRIPE_PUBLIC_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. Configura webhook en Stripe apuntando a:
   ```
   https://tudominio.com/api/webhooks/stripe
   ```

3. Prueba con pagos de prueba reales

4. Activa pagos reales cuando estés seguro

---

- ✅ Nunca expongas `STRIPE_SECRET_KEY` en el frontend
- ✅ Usa siempre HTTPS en producción
- ✅ Verifica webhooks con `STRIPE_WEBHOOK_SECRET`
- ✅ Valida los montos en el servidor antes de crear sesiones

---

## 🚀 Producción

Cuando estés listo para producción:

1. Activa tu cuenta de Stripe para pagos reales
2. Cambia a claves LIVE (`pk_live_...`, `sk_live_...`)
3. Configura webhooks para eventos como:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

---

## ❓ Solución de Problemas

### Error: "No hay productos en el carrito"
- Verifica que el carrito tenga items antes de hacer checkout

### Error: "Error al procesar el pago"
- Verifica que las claves de Stripe estén configuradas correctamente
- Revisa la consola del servidor para más detalles

### La redirección no funciona
- Asegúrate de que las URLs de success/cancel sean correctas
- Verifica que el servidor esté corriendo en el puerto esperado

---

## 📚 Recursos

- [Documentación de Stripe](https://stripe.com/docs)
- [Stripe Checkout](https://stripe.com/docs/checkout)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (para testing local de webhooks)
