# 🔌 Configuración de Webhook de Stripe

## ¿Qué es un Webhook?

Un webhook es una URL que Stripe llama automáticamente cuando ocurren eventos (pagos completados, fallidos, reembolsos, etc.). Sin esto, los pagos no se registran en tu BD.

## 🚀 Pasos para Configurar

### Paso 1: Abre Stripe Dashboard
1. Ve a https://dashboard.stripe.com
2. Inicia sesión con tu cuenta
3. Asegúrate de estar en **Modo de Prueba** (arriba a la izquierda)

### Paso 2: Accede a Webhooks
1. Click en **Developers** (izquierda)
2. Click en **Webhooks**
3. Click en **Add endpoint** (azul)

### Paso 3: Configura el Endpoint

**URL del endpoint:**
```
https://tu-dominio.com/api/stripe/webhook
```

Si estás en **desarrollo local**:
```
http://localhost:3000/api/stripe/webhook
```

> ⚠️ **Nota**: Para desarrollo local, Stripe NO puede acceder a localhost. Debes usar:
> - **ngrok**: Expone tu servidor local a internet
> - **O**: Usar Stripe CLI en modo forward

### Paso 4: Selecciona Eventos

**Eventos a escuchar:**
- ✅ `payment_intent.succeeded` - Pago completado
- ✅ `payment_intent.payment_failed` - Pago fallido  
- ✅ `charge.refunded` - Reembolso procesado

Deja los otros desmarcados de momento.

### Paso 5: Obtén el Webhook Secret

Después de crear el endpoint:
1. Stripe te mostrará un **Webhook signing secret**
2. Copia el valor (empieza con `whsec_`)
3. Agrégalo a tu `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_test_ABC123XYZ...
```

## 🔧 Configuración para Desarrollo Local

### Opción A: Usar ngrok (Recomendado)

1. **Descargar ngrok**: https://ngrok.com/download
2. **Ejecutar ngrok**:
   ```bash
   ngrok http 3000
   ```
3. Verás algo como:
   ```
   Forwarding  https://a1b2c3d4e5f6.ngrok.io -> http://localhost:3000
   ```
4. **URL del webhook será**:
   ```
   https://a1b2c3d4e5f6.ngrok.io/api/stripe/webhook
   ```
5. Configura esto en Stripe Dashboard

### Opción B: Usar Stripe CLI

1. **Instalar Stripe CLI**: https://stripe.com/docs/stripe-cli
2. **Autenticarse**:
   ```bash
   stripe login
   ```
3. **Escuchar eventos**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Stripe CLI te dará un webhook secret, agrégalo al `.env`

## ✅ Probar el Webhook

### Desde Stripe Dashboard:
1. Ve a **Webhooks** → Tu endpoint
2. Click en **Send test event**
3. Selecciona **payment_intent.succeeded**
4. Click en **Send test event**
5. Deberías ver un evento exitoso ✅

### Desde Terminal (con Stripe CLI):
```bash
stripe trigger payment_intent.succeeded
```

## 🔒 Verificar Webhook Secret

En tu código (`webhook.ts`), la verificación ocurre aquí:

```typescript
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

Si el secret no es correcto:
- ❌ Los eventos NO se procesarán
- ❌ Las órdenes NO se crearán en la BD

## 🚨 Troubleshooting

### Webhook no recibe eventos
**Solución**: 
- Verifica la URL es accesible desde internet
- En desarrollo local, usa ngrok o Stripe CLI
- Revisa el webhook secret en el `.env`

### Eventos se reciben pero no se procesan
**Solución**:
- Revisa los logs del backend
- Verifica que el webhook secret es correcto
- Comprueba que Supabase tiene las credenciales correctas

### La orden no se crea en la BD
**Solución**:
- Verifica que la tabla `orders` existe en Supabase
- Comprueba que `SUPABASE_SERVICE_ROLE_KEY` es correcto
- Revisa los logs de error en el backend

## 📝 Ambiente Production

Cuando pasas a producción:

1. **Usa tu webhook secret de PRODUCCIÓN**:
   - No confundas test y production secrets
   - En Stripe Dashboard, cambia de **Modo de Prueba** a **Modo Vivo**

2. **URL Real**:
   ```
   https://tu-dominio-produccion.com/api/stripe/webhook
   ```

3. **Mantén los secrets seguros**:
   - ✅ En variables de entorno
   - ❌ NUNCA en el código fuente
   - ❌ NUNCA en git

---

**¡Webhook configurado! Ya los eventos de Stripe llegarán a tu servidor.** ✨
