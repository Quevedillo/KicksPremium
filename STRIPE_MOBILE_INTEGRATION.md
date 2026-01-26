# 🎵 Integración de Stripe en KicksPremium Mobile

## 📋 Resumen de Cambios

Se ha integrado completamente **Stripe** como pasarela de pago nativa en la aplicación móvil Flutter. Los usuarios ahora pueden procesar pagos directamente desde el móvil sin necesidad de redirigirse a la web.

## 🚀 Cambios Implementados

### 1. **Dependencias Actualizadas** (`pubspec.yaml`)
- ✅ `flutter_stripe: ^10.4.0` - SDK de Stripe para Flutter
- ✅ `http: ^1.2.0` - Cliente HTTP para comunicar con el backend

### 2. **Servicio de Stripe** (`lib/data/services/stripe_service.dart`)
Nuevo servicio que maneja:
- Inicialización de Stripe
- Creación de Payment Intent
- Configuración del Payment Sheet
- Confirmación de pagos
- Procesamiento de reembolsos

### 3. **Pantalla de Checkout** (`lib/presentation/screens/checkout/checkout_screen.dart`)
Nueva pantalla con:
- Resumen de compra detallado
- Información de envío
- Método de pago (Stripe)
- Procesamiento seguro de pagos
- Manejo de errores

### 4. **Rutas Actualizadas** (`lib/presentation/router.dart`)
- ✅ Ruta `/checkout` - Pantalla de pago

### 5. **Providers Actualizados** (`lib/logic/providers.dart`)
- ✅ `userEmailProvider` - Para obtener el email del usuario autenticado

### 6. **Endpoints de Backend** (`src/pages/api/stripe/`)

#### a) **Create Payment Intent** (`create-payment-intent.ts`)
```
POST /api/stripe/create-payment-intent
```
- Crea un Payment Intent en Stripe
- Recibe: amount, currency, orderId, metadata
- Retorna: clientSecret, paymentIntentId

#### b) **Webhook** (`webhook.ts`)
```
POST /api/stripe/webhook
```
Procesa eventos de Stripe:
- `payment_intent.succeeded` - Pago exitoso
- `payment_intent.payment_failed` - Pago fallido
- `charge.refunded` - Reembolso procesado

#### c) **Refund** (`refund.ts`)
```
POST /api/stripe/refund
```
- Procesa reembolsos de pagos
- Requiere autenticación de admin

## 🔧 Configuración Necesaria

### 1. **Variables de Entorno** (Opcional - ya configuradas)

En `.env`:
```env
PUBLIC_STRIPE_PUBLIC_KEY=pk_test_51SLLkULJDIZy9upCBjdyv9JVBHGkfPar9msGEWIhYtaqzTStAjGx4yT0BG56tgvMH9vpiV8jNsJc3r2xIGWWd56O00e1C6AyX7
STRIPE_SECRET_KEY=sk_test_51SLLkULJDIZy9upC9bWdy3CBZBlr8qyinlC72dSXPaOG6DGOznzmf3TDr6z7ifrHp8HEPBaAixILvvljC1dp7zZl00AvAVD5F8
```

### 2. **Webhook de Stripe** (MUY IMPORTANTE)

Para que los pagos se registren correctamente en la BD:

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com)
2. Endpoints → Crear Endpoint
3. URL: `tu-dominio.com/api/stripe/webhook`
4. Eventos a escuchar:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copia el webhook secret y agrégalo al `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### 3. **URL del Backend en Móvil**

En `lib/data/services/stripe_service.dart`, actualiza:
```dart
static const String _backendUrl = 'http://localhost:3000';
```

- **Desarrollo local**: `http://localhost:3000` o `http://192.168.x.x:3000`
- **Producción**: `https://tu-dominio.com`

## 📱 Flujo de Pago en Móvil

```
1. Usuario añade productos al carrito
2. Hace click en "PROCEDER AL PAGO"
3. Si no está autenticado → Redirige a login
4. Si está autenticado → Va a pantalla de checkout
5. Revisa resumen y hace click en "PAGAR €XXX.XX"
6. Se abre Payment Sheet de Stripe
7. Introduce datos de tarjeta
8. Stripe procesa el pago
9. Webhook notifica al backend
10. Se crea la orden en Supabase
11. Se limpia el carrito
12. Usuario ve confirmación
```

## 🔒 Seguridad

- ✅ Stripe maneja toda la información sensible de tarjetas (PCI compliant)
- ✅ Payment Intent se crea en el backend, no en el frontend
- ✅ Webhook verifica la firma de Stripe
- ✅ Datos del usuario no se transmiten a Stripe directamente

## 🐛 Solución de Problemas

### Error: "Payment sheet initialization failed"
- Verifica que el `clientSecret` sea válido
- Comprueba la configuración de Stripe en el backend
- Revisa que el `PUBLIC_STRIPE_PUBLIC_KEY` sea correcto

### Error: "Error de conexión"
- Verifica que el backend está corriendo
- Comprueba la URL en `StripeService._backendUrl`
- En desarrollo, asegúrate de usar la IP correcta (no localhost)

### Pago completado pero no se registra en BD
- Verifica que el webhook está configurado
- Comprueba que el `STRIPE_WEBHOOK_SECRET` es correcto
- Revisa los logs del webhook en Stripe Dashboard

## 📚 Próximos Pasos Opcionales

- [ ] Agregar Apple Pay
- [ ] Agregar Google Pay
- [ ] Guardar métodos de pago (para pagos futuros)
- [ ] Panel de admin para gestionar reembolsos
- [ ] Notificaciones de pago por email

---

**¡La integración está lista! 🎉 Los usuarios ahora pueden pagar directamente desde la app móvil.**
