# Cambios Realizados - Sistema de Pedidos y Descuentos

## 1. ✅ Sistema de Emails de Newsletter (CORREGIDO)

### Problema
- El formulario reportaba éxito pero no se enviaban correos
- El código buscaba `BREVO_SMTP_KEY` pero en .env solo estaba `BREVO_API_KEY`

### Solución
- **Archivo modificado**: `src/lib/email.ts`
- Cambié el orden de validación para usar `BREVO_API_KEY` primero (que es lo correcto)
- Mejoré la verificación de conexión SMTP con manejo async/await correcto
- Ahora el BREVO_API_KEY se usa correctamente como contraseña SMTP

### Resultado
Cuando un usuario se suscribe al newsletter:
- ✅ Se registra en la tabla `newsletter_subscribers`
- ✅ Recibe un email de bienvenida con su código de descuento único (10% de descuento)
- ✅ El email incluye instrucciones y beneficios del newsletter

---

## 2. ✅ Sistema de Códigos de Descuento Mejorado

### Cambios
- **Archivo modificado**: `src/stores/cart.ts`
  - Agregué interfaz `DiscountCode` para tipado fuerte
  - Agregué campos `discountCode` y `discountApplied` al store del carrito
  - Nuevas funciones: `applyDiscountCode()` y `removeDiscountCode()`
  - Nuevas funciones de cálculo: `getCartSubtotal()`, `getDiscountAmount()`, `getCartTotal()`

- **Componente actualizado**: `src/components/islands/CartSlideOver.tsx`
  - Ahora muestra un campo para ingresar código de descuento
  - Valida el código en tiempo real llamando a `/api/discount/validate`
  - Muestra el descuento aplicado directamente en el precio del carrito
  - Desglose de precios:
    - Subtotal
    - Descuento aplicado (si hay)
    - Total final

### Características
- Los códigos se aplican antes de checkout
- El usuario ve el descuento reflejado inmediatamente
- Se puede remover el descuento en cualquier momento
- El código se envía al checkout para validación final

### Resultado
El usuario puede:
```
1. Agregar productos al carrito
2. Ingresar un código de descuento (ej: KICK20, WELCOME10)
3. Ver el descuento calculado en tiempo real
4. El descuento se aplica al total final
5. Proceder al checkout con el código validado
```

---

## 3. ✅ Información Completa en Mis Pedidos

### Estado Anterior
- Mostraba "Sin nombre" en algunos casos
- Faltaba información de productos

### Estado Actual
La página de pedidos (`src/pages/pedidos.astro`) ahora muestra:
- ✅ Número de pedido y fecha
- ✅ Estado del pedido (Completado, Pendiente, etc.)
- ✅ Monto total del pedido
- ✅ Lista completa de productos con:
  - Imagen del producto
  - Marca
  - Nombre
  - Talla seleccionada
  - Cantidad
  - Precio unitario
  - Subtotal del producto
- ✅ Dirección de envío completa
- ✅ Email de contacto
- ✅ Botón para descargar factura (NUEVO)

---

## 4. ✅ Sistema de Facturas PDF

### Nuevos Archivos
- **`src/lib/invoice.ts`**: Librería para generar PDFs de facturas
  - Función `generateInvoicePDF()`: Crea PDF profesional con:
    - Logo y nombre de empresa
    - Número y fecha de factura
    - Información del cliente
    - Dirección de envío
    - Tabla de productos con cantidades y precios
    - Subtotal, impuestos y total
    - Pie de página con información legal
  - Función `generateInvoiceFilename()`: Genera nombre único para archivo

- **`src/pages/api/orders/download-invoice.ts`**: Endpoint para descargar facturas
  - Valida que el usuario esté autenticado
  - Verifica que sea su propio pedido
  - Genera el PDF bajo demanda
  - Retorna como descarga directa

### Cambios en UI
- Botón "📄 Descargar Factura" en cada pedido
- Disponible para todos los pedidos completados
- Script en pedidos.astro para manejar descarga

### Dependencias
- Instalada: `pdfkit` para generación de PDFs

---

## 5. ✅ Email de Confirmación con Factura

### Cambios en el Sistema
- **`src/lib/email.ts`**:
  - Actualicé interfaz `OrderDetails` para incluir `invoicePDF?: Buffer`
  - Función `sendOrderConfirmationEmail()` ahora soporta attachments
  - El PDF se adjunta al email si está disponible

- **`src/pages/api/webhooks/stripe.ts`**:
  - Importé `generateInvoicePDF` de la librería de facturas
  - Cuando se completa un pago:
    1. Se genera el PDF de factura automáticamente
    2. Se adjunta al email de confirmación
    3. Se envía al cliente con toda la información del pedido
  - Manejo de errores sin bloquear el flujo (la orden se crea igual)

- **`src/pages/api/checkout/create-session.ts`**:
  - Agregué parámetro `discountCode` en el body
  - Se envía al metadata de Stripe para registro

### Resultado
Cuando el cliente completa una compra:
1. ✅ Se recibe confirmación de pago en Stripe
2. ✅ Se crea el pedido en Supabase
3. ✅ Se genera automáticamente un PDF de factura
4. ✅ Se envía email con:
   - Confirmación de pedido
   - Detalles de los productos
   - Dirección de envío
   - **PDF de factura adjunto**
5. ✅ También puede descargar la factura desde "Mis Pedidos"

---

## Flujo Completo de Compra

```
1. Usuario se suscribe al newsletter
   ↓
   → Recibe email con código de descuento (10%)
   → Código: WELCOME10 (válido 30 días)

2. Usuario compra productos
   ↓
   → Agrega productos al carrito
   → Ingresa código de descuento
   → Ve descuento aplicado en tiempo real
   → Procede al checkout

3. Pago completado
   ↓
   → Se genera factura PDF automáticamente
   → Se envía email con factura adjunta
   → Pedido aparece en "Mis Pedidos"

4. Usuario accede a "Mis Pedidos"
   ↓
   → Ve detalles completos del pedido
   → Puede descargar la factura
   → Puede solicitar devolución (si aplica)
```

---

## Validaciones y Características Especiales

### Sistema de Descuentos
- Los códigos se validan en tiempo real
- Función RPC `validate_discount_code` en Supabase verifica:
  - Código existe y no está expirado
  - Monto mínimo cumplido
  - Límite de usos no excedido
  - Usuario no ha usado más del límite permitido

### Códigos de Descuento Disponibles
- `WELCOME10`: 10% para nuevos suscriptores del newsletter
- Códigos personalizados pueden crearse en admin

### Seguridad
- Los descuentos se validan en backend
- No se pueden manipular en el cliente
- Las facturas solo se descargan si es el propietario del pedido
- Tokens de sesión verificados en todos los endpoints

---

## Próximas Mejoras (Opcionales)

1. **Validación de compras previas para códigos de primera compra**
   - Endpoint para verificar si usuario ha comprado antes
   - En validación de descuento, excluir "PRIMERA_COMPRA" si ya tiene órdenes

2. **Tracking de envíos**
   - Integración con API de courier
   - Emails con estado del envío

3. **Gestión de devoluciones mejorada**
   - Portal de devoluciones en usuario
   - Generación de etiquetas de retorno

4. **Reportes de facturas**
   - Descarga en lote de facturas
   - Exportar a formato contable

---

## Cómo Probar los Cambios

### 1. Newsletter y Descuentos
```bash
1. Ir a cualquier página
2. Buscar formulario de newsletter
3. Ingresar email
4. Revisar spam/promotions en email
5. Copiar código de descuento
6. Agregar productos
7. Ingresar código en carrito
8. Ver descuento aplicado
```

### 2. Compra con Descuento
```bash
1. Agregar productos al carrito
2. Aplicar código de descuento
3. Hacer checkout con Stripe
4. Usar tarjeta de prueba: 4242 4242 4242 4242
5. Completar pago
6. Ir a "Mis Pedidos"
7. Ver factura
8. Descargar PDF
9. Revisar email con factura adjunta
```

### 3. Validar Emails
- Check BREVO_API_KEY en .env está configurada
- Revisar logs en consola para errores SMTP
- Revisar spam/promotions en caso que no lleguen

---

## Variables de Entorno Requeridas

```env
# Brevo - Email (REQUERIDO)
BREVO_API_KEY=tu_clave_api_brevo
FROM_EMAIL=email_verificado@tudominio.com
ADMIN_EMAIL=admin@tudominio.com

# Supabase
PUBLIC_SUPABASE_URL=tu_url_supabase
PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Stripe
PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (opcional)
```

---

## Cambios de Archivos Resumen

```
✅ src/lib/email.ts - Corregido para usar BREVO_API_KEY correctamente
✅ src/lib/invoice.ts - NUEVO - Generación de PDFs de facturas
✅ src/stores/cart.ts - Agregado sistema de descuentos
✅ src/components/islands/CartSlideOver.tsx - UI para aplicar códigos
✅ src/pages/pedidos.astro - Botón de descargar factura
✅ src/pages/api/orders/download-invoice.ts - NUEVO - Endpoint de descarga
✅ src/pages/api/webhooks/stripe.ts - Generación y adjunto de facturas en emails
✅ src/pages/api/checkout/create-session.ts - Soporte para código de descuento
✅ package.json - Agregada dependencia 'pdfkit'
```

---

¡Tu tienda online ahora tiene un sistema completo de descuentos, facturas y emails! 🎉
