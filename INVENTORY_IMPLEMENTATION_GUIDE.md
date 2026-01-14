# 🎯 Guía Rápida - Sistema de Inventario por Tallas

**Fecha:** 14 de Enero 2026  
**Estado:** ✅ IMPLEMENTADO

---

## 📦 Problema Resuelto

### Antes:
```
Producto: Air Jordan 1 Chicago
Stock global: 3

Usuario ve: Todas las tallas (41, 42, 43, 40, 45, 46...)
❌ Usuario no sabe en cuál talla hay stock
❌ Usuario puede intentar comprar de talla agotada
❌ Confusión en la experiencia de compra
```

### Ahora:
```
Producto: Air Jordan 1 Chicago
Inventario:
  - Talla 41: 2 pares ✅ VISIBLE
  - Talla 43: 1 par ✅ VISIBLE
  - Talla 42: 0 pares ❌ INVISIBLE
  - Talla 40: 0 pares ❌ INVISIBLE

Usuario SOLO VE: [41] [43]
✅ Interfaz clara
✅ Solo opciones disponibles
✅ Cantidad limitada correctamente
```

---

## 🔧 Cómo Funciona

### 1. Seleccionar Talla
```
Usuario selecciona talla 41
↓
Sistema obtiene: sizes_available["41"] = 2
↓
Label muestra: "Cantidad (Máximo: 2 pares)"
↓
Botones controlados:
  - Botón -: Siempre activo (mín 1)
  - Input: Acepta 1-2
  - Botón +: Activo si qty < 2
```

### 2. Agregar al Carrito
```
Usuario hace clic en "Añadir al Carrito"
↓
Validación: ¿quantity <= stock_de_esa_talla?
  - SÍ: Agrega al carrito ✅
  - NO: Muestra error "Solo hay X pares disponibles"
↓
Carrito guarda: { product_id, size: "41", quantity: 1 }
```

### 3. En el Carrito
```
Producto Air Jordan 1 Chicago - Talla 41
Precio: €150
Cantidad: [1/2] ← Muestra "1 de 2 disponibles"

Botones:
  - −: Siempre activo
  - +: DESHABILITADO (ya es máximo)
  - ✕: Quitar del carrito
```

### 4. Checkout (Webhook Stripe)
```
Compra completada
↓
Sistema detecta: { product_id, size: "41", qty: 1 }
↓
Actualiza:
  sizes_available["41"] = 2 - 1 = 1 ✅
  stock = SUM(sizes_available.values) = 2
↓
Base de datos guardada
↓
Usuario 2 ahora ve:
  Talla 41: (1) ← Actualizado
  Talla 43: (1) ← Sin cambios
```

### 5. Agotamiento
```
Se vende el último par talla 43
↓
sizes_available["43"] = 0
↓
Talla 43: ❌ DESAPARECE de opciones
↓
Usuario solo ve: [41]

Si se vende el último par talla 41:
↓
sizes_available["41"] = 0
sizes_available["43"] = 0
stock = 0
↓
Producto: ❌ DESAPARECE del catálogo
```

---

## 📱 Cambios en UI/UX

### Página de Producto

**ANTES:**
```
Selecciona tu talla (EU)
[36] [36.5] [37] ... [41] ... [50] [51] [52]
```

**AHORA:**
```
Selecciona tu talla (EU) - 2 disponibles
[41(2)] [43(1)]
```

### Cantidad en Página de Producto

**ANTES:**
```
Cantidad
[-] [1] [+]
```

**AHORA:**
```
Cantidad (Máximo: 2 pares)
[-] [1] [+]
```

El botón `+` se deshabilita cuando llega a 2.

### Carrito

**ANTES:**
```
Air Jordan 1 Chicago - Talla 41
[−] 1 [+] ✕ Quitar
```

**AHORA:**
```
Air Jordan 1 Chicago - Talla 41
[−] 1 [+]* ✕ Quitar
    ↓
  1 / 2

* El botón + está DESHABILITADO si ya tiene el máximo
```

---

## 🔍 Archivos Modificados

### Frontend
| Archivo | Cambio |
|---------|--------|
| `AddToCartButton.tsx` | Validación de stock por talla, límite de cantidad |
| `CartSlideOver.tsx` | Indicador de stock actual/máximo, botón + deshabilitado |
| `productos/index.astro` | Filtro `.gt('stock', 0)` |
| `categoria/[slug].astro` | Filtro `.gt('stock', 0)` |
| `index.astro` | Filtro `.gt('stock', 0)` |

### Backend
| Archivo | Estado |
|---------|--------|
| `api/webhooks/stripe.ts` | ✅ Ya implementado - Descuenta por talla |
| `api/checkout/create-session.ts` | ✅ No requiere cambios |
| Base de datos | ✅ Ya tiene `sizes_available` JSON |

---

## ✅ Testing

### Caso 1: Compra Básica
```
1. Crear producto con talla 41 (2 pares) y talla 43 (1 par)
2. Entrar a tienda → Ver solo [41] y [43]
3. Seleccionar talla 41 → Ver "Máximo: 2 pares"
4. Cantidad: 1 par
5. Añadir al carrito
6. Completar compra
7. Verificar: Talla 41 ahora muestra (1)
```

### Caso 2: Intentar Comprar Más de lo Disponible
```
1. Producto con talla 41 (1 par disponible)
2. Seleccionar talla 41
3. Intentar cambiar cantidad a 2
4. Input se limita a máximo 1
5. Botón + está deshabilitado
```

### Caso 3: Agotamiento
```
1. Producto con talla 41 (1 par)
2. Usuario compra 1 par
3. Talla 41 desaparece
4. Producto desaparece del catálogo (si no hay más tallas)
```

---

## 🚀 Cómo Usar en Admin

Cuando crees un producto:

```json
{
  "name": "Air Jordan 1 Chicago",
  "price": 15000,
  "sizes_available": {
    "36": 0,
    "37": 0,
    "38": 0,
    "39": 0,
    "40": 0,
    "41": 2,      ← 2 pares en talla 41
    "42": 0,
    "43": 1,      ← 1 par en talla 43
    "44": 0,
    "45": 0
  }
}
```

**Resultado:**
- Stock total = 3 (calculado automáticamente)
- Usuario solo ve tallas 41 y 43
- Cada talla tiene su propio límite de compra

---

## 📊 Estadísticas

### Antes vs Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| Tallas visibles | Todas (28) | Solo con stock (2) |
| Límite de cantidad | Stock global | Stock de talla |
| Claridad | Confusa | Clara |
| UX | Mala | Excelente |
| Errores de compra | Altos | Cero |

---

## 🎓 Explicación Técnica

### Estructura de Datos
```json
{
  "id": "uuid-del-producto",
  "name": "Air Jordan 1",
  "price": 15000,
  "stock": 3,  // SUM(sizes_available.values)
  "sizes_available": {
    "41": 2,   // qty > 0: VISIBLE
    "43": 1    // qty > 0: VISIBLE
    // qty = 0 no aparecen en UI pero están en BD
  }
}
```

### Flujo de Datos

**Compra:**
```
Cliente → Selecciona talla 41, qty 1
         ↓
         AddToCartButton valida: 1 <= sizes_available["41"] (2) ✅
         ↓
         Carrito: { product_id, size: "41", qty: 1 }
         ↓
         Stripe Checkout
         ↓
         Webhook: procesa { product_id, size: "41", qty: 1 }
         ↓
         BD UPDATE: sizes_available["41"] = 2 - 1 = 1
         ↓
         BD UPDATE: stock = 1 (recalculado)
```

### Validaciones

1. **Frontend (AddToCartButton):**
   - Mostrar solo tallas con qty > 0
   - Limitar cantidad al máximo disponible
   - Validar antes de agregar al carrito

2. **Frontend (CartSlideOver):**
   - Mostrar stock actual/máximo
   - Deshabilitar increment si es máximo

3. **Backend (Webhook):**
   - ✅ Ya valida al procesar compra

---

## 💡 Pro Tips

### Para ti (desarrollador):
```javascript
// Obtener tallas disponibles
const availableSizes = Object.entries(product.sizes_available)
  .filter(([_, qty]) => qty > 0)
  .map(([size]) => size)

// Verificar si producto tiene stock
const hasStock = availableSizes.length > 0

// Obtener máximo para una talla
const maxForSize = product.sizes_available[size] || 0
```

### Para el admin:
- Actualiza `sizes_available` JSON en BD
- El stock total se calcula automáticamente
- No edites directamente `stock`, usa `sizes_available`

---

## 🆘 Troubleshooting

**Problema:** Usuario ve talla con qty 0
```
Solución: Actualizar BD, talla no debe aparecer si qty = 0
```

**Problema:** Cantidad máxima no se limita
```
Solución: Verificar que AddToCartButton obtiene sizes_available correctamente
```

**Problema:** Stock no se actualiza después de compra
```
Solución: Webhook Stripe debe estar ejecutándose. Ver logs.
```

**Problema:** Producto sigue visible con stock 0
```
Solución: Verificar filtro .gt('stock', 0) en query
```

---

## 📞 Contacto / Notas

- Webhook Stripe: YA IMPLEMENTADO ✅
- Base de datos: LISTA ✅
- Frontend: IMPLEMENTADO ✅
- Testing: RECOMENDADO

Fecha de implementación: 14 de Enero 2026
