# ✅ Checklist - Stripe Mobile Ready for Production

## 🔐 Seguridad

- [ ] **Public Key Correcta**
  - [ ] Usa `PUBLIC_STRIPE_PUBLIC_KEY` (test o live, según ambiente)
  - [ ] ❌ NO está hardcodeada en el código

- [ ] **Secret Key Protegida**
  - [ ] Solo en variables de entorno del backend
  - [ ] ❌ NO en el repositorio git
  - [ ] ❌ NO se transmite al móvil

- [ ] **Webhook Secret Configurado**
  - [ ] Agregado a `.env` como `STRIPE_WEBHOOK_SECRET`
  - [ ] Verificación activada en `webhook.ts`
  - [ ] ❌ No hardcodeado

## 🌐 Configuración de Backend

- [ ] **URL del Backend Correcta**
  - [ ] Desarrollo: `http://localhost:3000` (móvil en emulador)
  - [ ] Producción: `https://tu-dominio.com`
  - [ ] En `lib/data/services/stripe_service.dart`

- [ ] **Endpoints Creados**
  - [ ] `/api/stripe/create-payment-intent.ts` ✅ (creado)
  - [ ] `/api/stripe/webhook.ts` ✅ (creado)
  - [ ] `/api/stripe/refund.ts` ✅ (creado)

- [ ] **Base de Datos**
  - [ ] Tabla `orders` existe y tiene columnas:
    - `payment_status` (text)
    - `payment_intent_id` (text)
  - [ ] RLS policies configuradas (si es necesario)

- [ ] **CORS Configurado (si es necesario)**
  - [ ] Headers permitidos en Astro
  - [ ] Origen del móvil permitido

## 📱 Aplicación Móvil

- [ ] **Dependencias Instaladas**
  - [ ] `flutter_stripe: ^10.4.0` ✅
  - [ ] `http: ^1.2.0` ✅
  - [ ] Ejecutado: `flutter pub get`

- [ ] **Pantalla de Checkout**
  - [ ] Resumen de compra funciona
  - [ ] Total se calcula correctamente (en centavos)
  - [ ] Email del usuario pre-llenado
  - [ ] Botón de pago visible

- [ ] **Flujo de Pago**
  - [ ] Payment Sheet se abre correctamente
  - [ ] Acepta todas las tarjetas
  - [ ] Muestra errores si el pago falla
  - [ ] Limpia el carrito después del éxito
  - [ ] Redirige a "Mis Pedidos"

- [ ] **Manejo de Errores**
  - [ ] Conexión: Muestra "Error de conexión"
  - [ ] Cancelado: Permanece en checkout
  - [ ] Rechazado: Muestra error de Stripe
  - [ ] Sin internet: Maneja gracefully

## 🔌 Webhook

- [ ] **Configurado en Stripe Dashboard**
  - [ ] URL: `https://tu-dominio.com/api/stripe/webhook`
  - [ ] Eventos suscritos:
    - [ ] `payment_intent.succeeded`
    - [ ] `payment_intent.payment_failed`
    - [ ] `charge.refunded`
  - [ ] Webhook Secret guardado en `.env`

- [ ] **Funcionamiento Probado**
  - [ ] Enviar evento test desde Dashboard
  - [ ] Verificar que se procesa sin errores
  - [ ] Comprobar que la orden se crea en BD

## 🧪 Pruebas

- [ ] **Pago Exitoso**
  - [ ] Tarjeta: 4242 4242 4242 4242
  - [ ] Resultado: ✅ Pago completado

- [ ] **Pago Rechazado**
  - [ ] Tarjeta: 4000 0000 0000 0002
  - [ ] Resultado: ❌ Error visible

- [ ] **Pago Cancelado**
  - [ ] Abrir Payment Sheet
  - [ ] Hacer click atrás o cerrar
  - [ ] Resultado: Permanece en checkout

- [ ] **Validaciones**
  - [ ] Carrito vacío: No permite pagar
  - [ ] Usuario no logueado: Redirige a login
  - [ ] Moneda: EUR (€)
  - [ ] Total: Se envía en centavos

- [ ] **Base de Datos**
  - [ ] Orden se crea después del pago
  - [ ] `payment_status = 'completed'`
  - [ ] `payment_intent_id` guardado
  - [ ] Usuario vinculado correctamente

## 📧 Emails

- [ ] **Confirmación de Compra**
  - [ ] Se envía después del pago
  - [ ] Contiene detalles del pedido
  - [ ] Link para ver el pedido

- [ ] **Notificación Admin**
  - [ ] Admin recibe notificación (opcional)
  - [ ] Contiene info de la orden

## 🚀 Ambiente

### Desarrollo
- [ ] Backend en `http://localhost:3000`
- [ ] Usando claves **TEST** de Stripe
- [ ] Webhook con **ngrok** o **Stripe CLI**
- [ ] Datos de prueba en BD

### Staging (Opcional)
- [ ] Backend en `https://staging.tu-dominio.com`
- [ ] Usando claves **TEST** de Stripe
- [ ] Webhook real configurado
- [ ] Datos de prueba en BD

### Producción
- [ ] Backend en `https://tu-dominio.com`
- [ ] Usando claves **LIVE** de Stripe
- [ ] Webhook real configurado
- [ ] BD de producción
- [ ] HTTPS obligatorio
- [ ] Certificado SSL válido

## 📊 Monitoreo

- [ ] **Dashboard de Stripe**
  - [ ] Revisar pagos procesados
  - [ ] Monitorear tasa de rechazos
  - [ ] Revisar errores/fallos

- [ ] **Logs del Backend**
  - [ ] Registrar todos los eventos
  - [ ] Monitorear errores de webhook
  - [ ] Alertas de fallos

- [ ] **Base de Datos**
  - [ ] Monitorear crecimiento de ordenes
  - [ ] Alertas de errores de inserción
  - [ ] Backups automáticos activados

## 🔄 Rollback Plan

En caso de emergencia:

1. **Si Stripe falla:**
   - [ ] Mostrar mensaje: "Servicio de pago temporalmente no disponible"
   - [ ] Guardar carrito para reintentar después

2. **Si Webhook falla:**
   - [ ] Re-procesar webhooks desde Dashboard de Stripe
   - [ ] Manual fix de órdenes si es necesario

3. **Si BD falla:**
   - [ ] Revertir a backup anterior
   - [ ] Re-procesar pagos si es necesario

## 📋 Documentación

- [ ] **Readme actualizado** con instrucciones de setup
- [ ] **Variables de entorno documentadas** (.env.example)
- [ ] **Guía de troubleshooting** creada
- [ ] **Logs documentados** para debugging

---

## ✅ FINAL CHECKLIST

```
¿Todas las casillas están marcadas?

SI → ¡Listo para producción! 🚀
NO → Revisa qué falta y completa antes de publicar
```

---

**Última revisión:** 26 de enero de 2026  
**Responsable:** Equipo de Desarrollo  
**Próxima revisión:** Después de primer mes en producción
