# 🧪 Guía de Pruebas - Integración Stripe Mobile

## ✅ Pre-requisitos

1. **Backend corriendo**
   ```bash
   cd ~/tiendaOnline
   npm run dev
   # Debe estar en http://localhost:3000
   ```

2. **App móvil compilada**
   ```bash
   cd kickspremium_mobile
   flutter pub get
   flutter run
   ```

3. **Variables de entorno configuradas**
   - ✅ `PUBLIC_STRIPE_PUBLIC_KEY` en `.env` del móvil
   - ✅ `STRIPE_SECRET_KEY` en el backend

## 🧪 Casos de Prueba

### 1️⃣ **Prueba de Checkout sin Autenticación**
```
✓ Usuario NO logueado
✓ Abre carrito
✓ Hace click en "PROCEDER AL PAGO"
✓ Debe redirigir a login
✓ Después de login, vuelve al carrito
```

### 2️⃣ **Prueba de Carrito Vacío**
```
✓ Limpiar carrito
✓ Intentar ir a checkout
✓ Debe mostrar "Tu carrito está vacío"
✓ Botón para volver a comprar
```

### 3️⃣ **Prueba de Resumen de Compra**
```
✓ Agregar productos al carrito
✓ Ir a checkout
✓ Verificar que se muestren todos los items
✓ Verificar cálculo correcto del total
✓ Verificar información de envío
```

### 4️⃣ **Prueba de Pago Exitoso** 
```
✓ Completar checkout
✓ Usar tarjeta de prueba: 4242 4242 4242 4242
✓ Fecha: 12/26 (cualquiera en el futuro)
✓ CVC: 123 (cualquiera)
✓ Nombre: Cualquiera
```

**Resultado esperado:**
- ✅ Payment Sheet se cierra
- ✅ Mensaje "¡Pago realizado con éxito!"
- ✅ Carrito se limpia
- ✅ Redirige a "Mis Pedidos"
- ✅ La orden aparece en la lista

### 5️⃣ **Prueba de Pago Fallido**
```
✓ Completar checkout
✓ Usar tarjeta que rechaza: 4000 0000 0000 0002
```

**Resultado esperado:**
- ✅ Payment Sheet muestra error
- ✅ Se puede reintentar
- ✅ El carrito NO se limpia

### 6️⃣ **Prueba de Pago Cancelado**
```
✓ Completar checkout
✓ Hacer click atrás o cerrar Payment Sheet
```

**Resultado esperado:**
- ✅ Payment Sheet se cierra
- ✅ Permanece en pantalla de checkout
- ✅ El carrito NO se limpia

### 7️⃣ **Prueba de Validaciones**
```
✓ Moneda es EUR (€)
✓ Cantidad se envía en centavos (multiplica por 100)
✓ Email del usuario se incluye en metadata
✓ Order ID es único
```

### 8️⃣ **Prueba de Webhook** (Opcional - Avanzado)
```
✓ Ir a Stripe Dashboard → Webhooks
✓ Ver los eventos de prueba
✓ Verificar que se procesen correctamente
✓ Comprobar que la orden se actualiza en BD
```

## 🔐 Tarjetas de Prueba

| Caso | Tarjeta | Resultado |
|------|---------|-----------|
| Éxito | 4242 4242 4242 4242 | ✅ Pago aprobado |
| Rechazo | 4000 0000 0000 0002 | ❌ Pago rechazado |
| Error 3D Secure | 4000 0025 0000 3155 | ⚠️ Requiere autenticación |
| Expirada | 4000 0000 0000 0069 | ❌ Tarjeta expirada |

**Para todas:** Use cualquier fecha futura y CVC de 3 dígitos

## 🔍 Debug & Logs

### En el móvil (Flutter):
```dart
// Ver logs en la consola
flutter logs
```

### En el backend:
```bash
# Ver logs en la terminal donde corre npm run dev
```

### En Stripe Dashboard:
```
Developers → Events → Ver historial de pagos
Webhooks → Ver entregas de eventos
```

## 📊 Verificaciones Finales

- [ ] El Payment Sheet aparece con estilo oscuro
- [ ] El usuario ve su email en el formulario
- [ ] Los datos de la tarjeta están encriptados (no aparecen en logs)
- [ ] La orden se crea en Supabase después del pago
- [ ] El carrito se limpia automáticamente
- [ ] Los emails se envían (si está configurado)
- [ ] El total en la pantalla coincide con lo cobrado

## 🚨 Errores Comunes

### "Error de conexión"
- **Causa**: Backend no está corriendo o URL es incorrecta
- **Solución**: Verifica que está en `http://localhost:3000`

### "Payment sheet initialization failed"
- **Causa**: clientSecret inválido o vencido
- **Solución**: Verifica el endpoint `/api/stripe/create-payment-intent`

### "El carrito no se limpia"
- **Causa**: Pago se procesó pero la función `clearCart()` falla
- **Solución**: Revisa los logs de Flutter

### "La orden no aparece en BD"
- **Causa**: Webhook no está configurado o falla
- **Solución**: Configura el webhook en Stripe Dashboard

---

**¡Lista para producción después de pasar todas las pruebas!** 🚀
