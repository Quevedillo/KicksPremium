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

---

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

## 🔒 Seguridad

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
