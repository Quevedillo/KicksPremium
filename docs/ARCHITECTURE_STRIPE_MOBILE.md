# 📊 Arquitectura - Stripe Mobile Integration

## 🏗️ Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                     KICKSPREMIUM ECOSYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐           ┌──────────────────┐
│   WEB (Astro)    │           │  MOBILE (Flutter)│
├──────────────────┤           ├──────────────────┤
│  - Homepage      │           │  - Home          │
│  - Catálogo      │◄─────────►│  - Productos     │
│  - Checkout      │   Supabase│  - Carrito       │
│  - Admin Panel   │           │  - Checkout NEW  │
└────────┬─────────┘           └────────┬─────────┘
         │                              │
         │                              │
         └──────────────┬───────────────┘
                        │
            ┌───────────▼───────────┐
            │  Supabase Backend     │
            ├───────────────────────┤
            │ - Products            │
            │ - Orders              │
            │ - Users               │
            │ - Categories          │
            │ - Newsletter Subs      │
            └─────────┬─────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    ┌────────┐  ┌──────────┐  ┌────────────┐
    │ Stripe │  │  Resend  │  │ Cloudinary │
    └────────┘  └──────────┘  └────────────┘
    (Pagos)     (Emails)      (Imágenes)
```

## 🔄 Flujo de Pago - Móvil

```
FASE 1: PREPARACIÓN
┌─────────────────────┐
│ Usuario logueado    │
│ Carrito NO vacío    │
└────────────┬────────┘
             │
             ▼
┌─────────────────────────────────┐
│ CartScreen                      │
│  - Muestra items                │
│  - Total: €XXX.XX               │
│  - Botón: "PROCEDER AL PAGO"    │
└────────────┬────────────────────┘
             │
             ▼
        click pagar
             │
             ▼
┌──────────────────────────────────────┐
│ CheckoutScreen                       │
│  - Resumen de compra                 │
│  - Información de envío              │
│  - Método de pago                    │
│  - Botón: "PAGAR €XXX.XX"            │
└────────────┬─────────────────────────┘
             │
             ▼

FASE 2: CREAR PAYMENT INTENT
             │
             ├─ POST /api/stripe/create-payment-intent
             │  { amount: 5999, currency: "eur", orderId: "xxx" }
             │
             ▼ (Backend)
┌────────────────────────────────────┐
│ Backend (Astro)                    │
│  stripe.paymentIntents.create()    │
└────────────┬───────────────────────┘
             │
             ▼ (Stripe)
┌────────────────────────────────────┐
│ Stripe                             │
│  Crea Payment Intent               │
│  Retorna: clientSecret             │
└────────────┬───────────────────────┘
             │
             ▼ (Backend)
        Retorna al móvil:
        { clientSecret: "pi_xxx_secret_yyy" }
             │
             ▼

FASE 3: PROCESAR PAGO
             │
             ├─ initializePaymentSheet(clientSecret)
             │
             ▼
┌──────────────────────────┐
│ Payment Sheet            │
│ (Widget de Stripe)       │
│                          │
│  💳 Datos de tarjeta     │
│  📅 Fecha                │
│  🔐 CVC                  │
│                          │
│  [PAGAR]                 │
└─────────┬────────────────┘
          │
          ▼
  Usuario ingresa tarjeta
          │
          ▼
┌──────────────────────────┐
│ Stripe (Encriptado)      │
│  - Procesa tarjeta       │
│  - Valida fondos         │
│  - Retorna confirmación  │
└─────────┬────────────────┘
          │
          ▼

FASE 4: CONFIRMACIÓN Y WEBHOOK
          │
          ├─ confirmPaymentSheetPayment()
          │
          ▼
┌────────────────────────────┐
│ Payment Sheet              │
│  ✅ Pago procesado         │
│  └─ Se cierra              │
└────────┬───────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Backend (Webhook)                │
│                                  │
│ Stripe envía evento:             │
│ payment_intent.succeeded         │
│                                  │
│ Backend:                         │
│ - Crea orden en Supabase         │
│ - Status: 'completed'            │
│ - Guarda payment_intent_id       │
└────────┬───────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Móvil                            │
│  - Limpia carrito                │
│  - Muestra "¡Éxito!"             │
│  - Redirige a "Mis Pedidos"      │
└──────────────────────────────────┘
         │
         ▼
    ✅ COMPRA COMPLETADA
```

## 🗂️ Estructura de Archivos

```
tiendaOnline/
├── kickspremium_mobile/
│   ├── pubspec.yaml (dependencias ✅)
│   └── lib/
│       ├── data/
│       │   └── services/
│       │       └── stripe_service.dart ✅ NUEVO
│       ├── logic/
│       │   └── providers.dart (actualizado ✅)
│       └── presentation/
│           ├── router.dart (actualizado ✅)
│           └── screens/
│               ├── cart/
│               │   └── cart_screen.dart (actualizado ✅)
│               └── checkout/
│                   └── checkout_screen.dart ✅ NUEVO
│
├── src/
│   └── pages/api/
│       └── stripe/ ✅ NUEVA CARPETA
│           ├── create-payment-intent.ts ✅ NUEVO
│           ├── webhook.ts ✅ NUEVO
│           └── refund.ts ✅ NUEVO
│
├── STRIPE_MOBILE_INTEGRATION.md ✅ NUEVO
├── STRIPE_MOBILE_QUICK_START.md ✅ NUEVO
├── TESTING_STRIPE_MOBILE.md ✅ NUEVO
├── WEBHOOK_SETUP.md ✅ NUEVO
└── PRODUCTION_CHECKLIST.md ✅ NUEVO
```

## 🔐 Seguridad - Flujo de Datos

```
TARJETA DEL USUARIO
        │
        ├─ NUNCA va al servidor backend
        ├─ NUNCA se guarda en BD
        └─ Va DIRECTAMENTE encriptada a Stripe
           (PCI DSS Compliant)

PAYMENT INTENT
        │
        ├─ Se crea en el backend (seguro)
        ├─ clientSecret va al móvil
        └─ Stripe verifica que coincide

WEBHOOK
        │
        ├─ Stripe firma el evento
        ├─ Backend verifica la firma
        ├─ Solo si es válido, se procesa
        └─ Se crea la orden en BD
```

## 📈 Cambios de Estado de la Orden

```
┌──────────┐
│   NUEVO  │ (carrito)
└────┬─────┘
     │ (click pagar)
     ▼
┌──────────────────┐
│  PROCESANDO PAGO │ (checkout)
└────┬─────────────┘
     │ (stripe procesa)
     ├─ payment_intent.succeeded
     │  ▼
     │  ┌───────────────┐
     │  │  COMPLETADO   │ ✅
     │  └───────────────┘
     │
     └─ payment_intent.payment_failed
        ▼
        ┌────────────┐
        │   FALLIDO   │ ❌
        └────────────┘
```

## 📞 Endpoints API

```
POST /api/stripe/create-payment-intent
├─ Input:
│  ├─ amount: number (en centavos: 5999 = €59.99)
│  ├─ currency: string ("eur")
│  ├─ orderId: string (ID único)
│  └─ metadata: object
│
└─ Output:
   ├─ clientSecret: string
   └─ paymentIntentId: string

POST /api/stripe/webhook
├─ Input:
│  └─ Stripe event (signature + body)
│
└─ Output:
   ├─ Event: payment_intent.succeeded
   │  └─ Crea/actualiza orden en BD
   ├─ Event: payment_intent.payment_failed
   │  └─ Marca orden como fallida
   └─ Event: charge.refunded
      └─ Marca orden como reembolsada

POST /api/stripe/refund
├─ Input:
│  └─ paymentIntentId: string
│
└─ Output:
   ├─ refundId: string
   └─ amount: number (en euros)
```

## 🎯 Responsabilidades

```
📱 MÓVIL (Flutter)
├─ Mostrar carrito
├─ Abrir Payment Sheet
├─ Limpiar carrito (en éxito)
└─ Mostrar mensajes al usuario

🖥️ BACKEND (Astro)
├─ Crear Payment Intent en Stripe
├─ Procesar webhook (eventos de Stripe)
├─ Crear/actualizar órdenes en BD
└─ Enviar confirmación por email

💳 STRIPE
├─ Procesar tarjeta (encriptado)
├─ Autorizar pago
├─ Enviar eventos webhook
└─ Retornar resultado

🗄️ SUPABASE
├─ Guardar órdenes
├─ Asociar con usuario
└─ Historial de pagos
```

---

**Última actualización:** 26 de enero de 2026
**Versión:** 1.0 - Production Ready
