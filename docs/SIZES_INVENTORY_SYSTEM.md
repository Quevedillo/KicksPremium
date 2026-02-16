# 🏗️ Sistema de Control de Tallas por Stock - Plan de Implementación

**Fecha:** 14 de enero de 2026  
**Objetivo:** Implementar un sistema granular de control de tallas donde cada talla tiene su propio stock independiente.

---

## 📊 Estado Actual vs Deseado

### ❌ PROBLEMA ACTUAL
- Hay un `stock` total global y un `sizes_available` JSON
- El usuario ve todas las tallas disponibles (aunque algunas tengan 0)
- Al comprar, solo se resta del stock total, no del stock de talla específica
- Las tallas agotadas siguen siendo visibles

### ✅ OBJETIVO FINAL
```
Zapato: "Air Jordan 1 Retro High OG Chicago"

STOCK ACTUAL:
- Talla 41: 2 pares ✓
- Talla 43: 1 par ✓
- Talla 42: 0 pares ✗ (NO MOSTRAR)

Usuario SOLO ve: [41] [43]
Usuario NO puede elegir: 40, 42, 44, 45...

Al comprar 1 par talla 41:
- Stock talla 41: 2 → 1
- Si stock talla 41 llega a 0 → Desaparece de opciones
```

---

## 🗄️ Base de Datos - Cambios Requeridos

### Tabla: `products`

**Estructura ACTUAL:**
```sql
- id (UUID)
- stock INTEGER (stock total global)
- sizes_available JSONB (Ej: {"41": 2, "43": 1})
```

**Estructura NUEVA (misma, sin cambios):**
```sql
- id (UUID)
- stock INTEGER (GENERADO: suma de todos los tamaños)
- sizes_available JSONB 
  {
    "41": 2,
    "43": 1,
    "42": 0,
    "45": 0
  }
```

**Vista Helper Propuesta:**
```sql
-- Crear una VISTA para obtener solo las tallas disponibles
CREATE OR REPLACE VIEW products_available_sizes AS
SELECT 
  p.id,
  p.name,
  p.sizes_available,
  (SELECT jsonb_object_agg(size, qty)
   FROM jsonb_each_int(p.sizes_available) AS t(size, qty)
   WHERE qty > 0) as sizes_in_stock
FROM products p;
```

### Tabla: `order_items` (mejorar)

**Agregar columna:**
```sql
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size_ordered VARCHAR(10);
```

**Ahora guarda:**
- Qué talla se compró
- Cuántos pares de esa talla

---

## 🎨 Cambios en Frontend

### 1. [src/components/islands/SizePicker.tsx](src/components/islands/SizePicker.tsx)

**Cambios necesarios:**
```tsx
interface SizePickerProps {
  sizesAvailable: Record<string, number>; // { "41": 2, "43": 1 }
  onSizeSelect: (size: string, quantity: number) => void;
}

export const SizePicker = ({ sizesAvailable }) => {
  // SOLO mostrar tallas con cantidad > 0
  const availableSizes = Object.entries(sizesAvailable)
    .filter(([_, quantity]) => quantity > 0)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b));

  // Si no hay tallas disponibles
  if (availableSizes.length === 0) {
    return <div>Producto agotado</div>;
  }

  return (
    <div>
      {availableSizes.map(([size, quantity]) => (
        <button
          key={size}
          onClick={() => selectSize(size)}
          className={`...`}
        >
          {size} ({quantity} disponibles)
        </button>
      ))}
    </div>
  );
};
```

### 2. [src/components/islands/AddToCartButton.tsx](src/components/islands/AddToCartButton.tsx)

**Cambios necesarios:**
```tsx
// SOLO mostrar tallas con stock > 0
const sizes = product.sizes_available 
  ? Object.entries(product.sizes_available)
      .filter(([_, qty]) => qty > 0)  // 🔑 FILTRO IMPORTANTE
      .map(([size]) => size)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
  : [];

// Desactivar botón si no hay tallas
if (sizes.length === 0) {
  return <div>Agotado</div>;
}

// Verificar disponibilidad de talla específica
const getSizeAvailability = (size: string): number => {
  return product.sizes_available?.[size] || 0;
};
```

### 3. [src/pages/productos/[slug].astro](src/pages/productos/[slug].astro)

**Cambios necesarios:**
```astro
// SOLO mostrar si hay tallas disponibles
{product.sizes_available && 
 Object.values(product.sizes_available).some((qty: number) => qty > 0) ? (
  <div class="bg-brand-gray p-4 rounded-lg">
    <SizePicker
      sizesAvailable={product.sizes_available}
      client:only="react"
    />
  </div>
) : null}

// Mostrar estado correcto
{product.stock > 0 ? (
  <span class="text-green-500 text-sm font-bold">✓ En stock (Tallas: {Object.keys(product.sizes_available || {}).filter(s => product.sizes_available[s] > 0).join(', ')})</span>
) : (
  <span class="text-red-500 text-sm font-bold">✗ Agotado</span>
)}
```

---

## ⚙️ Cambios en Backend

### 1. [src/pages/api/webhooks/stripe.ts](src/pages/api/webhooks/stripe.ts)

**Cambio crítico - Restar stock por talla:**

```typescript
// EN LUGAR DE:
newStock = Math.max(0, (product.stock || 0) - quantity);

// HACER:
let newSizesAvailable = product.sizes_available || {};
const itemSize = item.size; // La talla de lo que se compró

if (itemSize && newSizesAvailable[itemSize]) {
  newSizesAvailable[itemSize] = Math.max(
    0, 
    (newSizesAvailable[itemSize] || 0) - quantity
  );
}

// Recalcular stock total
const newStock = Object.values(newSizesAvailable).reduce(
  (sum: number, qty: number) => sum + qty, 
  0
);

// Actualizar en BD
await supabase
  .from('products')
  .update({
    stock: newStock,
    sizes_available: newSizesAvailable,
  })
  .eq('id', productId);
```

### 2. [src/pages/api/admin/products/index.ts](src/pages/api/admin/products/index.ts)

**Al crear producto:**
```typescript
// Garantizar que sizes_available está formateado correctamente
const sizesAvailable = req.body.sizes_available || {};
// Validar que solo contenga números
const validSizes = Object.fromEntries(
  Object.entries(sizesAvailable).map(([size, qty]: [string, any]) => [
    size,
    Math.max(0, parseInt(qty) || 0)
  ])
);
```

### 3. [src/pages/admin/productos/nuevo.astro](src/pages/admin/productos/nuevo.astro)

**Interfaz de admin mejorada:**

```html
<div>
  <label>Configurar Tallas y Stock:</label>
  <table>
    <thead>
      <tr>
        <th>Talla</th>
        <th>Cantidad (pares)</th>
        <th>Acción</th>
      </tr>
    </thead>
    <tbody id="sizesTable">
      <!-- Filas dinámicas -->
    </tbody>
  </table>
  <button onclick="addSizeRow()">+ Agregar talla</button>
  <div>
    <strong>Stock Total: <span id="totalStock">0</span></strong>
  </div>
</div>

<script>
function updateTotalStock() {
  const rows = document.querySelectorAll('#sizesTable tr');
  let total = 0;
  rows.forEach(row => {
    const qty = parseInt(row.querySelector('input[type="number"]').value) || 0;
    total += qty;
  });
  document.getElementById('totalStock').textContent = total;
  
  // Actualizar campo hidden con JSON
  const sizesData = {};
  rows.forEach(row => {
    const size = row.querySelector('input[type="text"]').value;
    const qty = parseInt(row.querySelector('input[type="number"]').value) || 0;
    if (size) sizesData[size] = qty;
  });
  document.getElementById('sizesAvailable').value = JSON.stringify(sizesData);
}
</script>
```

---

## 📱 Flujo de Usuario

### Escenario: Compra exitosa

```
1️⃣ USUARIO ENTRA A PRODUCTO
   - Zapato: Air Jordan 1 Chicago
   - Tallas visibles: [41] [43]
   - Talla 42, 40, etc. NO SE MUESTRAN (stock = 0)

2️⃣ USUARIO SELECCIONA TALLA
   - Selecciona: Talla 41
   - Sistema muestra: "2 pares disponibles"

3️⃣ USUARIO AGREGA AL CARRITO
   - Carrito guarda: { product_id, size: "41", qty: 1 }

4️⃣ USUARIO COMPLETA COMPRA
   - Stripe webhook recibe compra
   - Sistema identifica: size = "41"
   - Actualiza: sizes_available["41"] = 2 - 1 = 1 ✓

5️⃣ USUARIO 2 VE ACTUALIZADO
   - Talla 41 ahora muestra: "1 par disponible"

6️⃣ SI ÚLTIMO PAR SE VENDE
   - sizes_available["41"] = 0
   - Talla 41 DESAPARECE de opciones
   - Producto sigue existiendo pero sin esa talla
```

---

---

## ✅ IMPLEMENTACIÓN COMPLETADA - 14 de Enero 2026

### Cambios Realizados

#### 1. Frontend - Validación de Stock por Talla

**[src/components/islands/AddToCartButton.tsx](src/components/islands/AddToCartButton.tsx)**
```
✓ Agregar función getMaxQuantityForSize() para obtener stock de la talla seleccionada
✓ Limitar cantidad máxima al stock disponible de esa talla
✓ Mostrar límite de cantidad en el label: "Cantidad (Máximo: X pares)"
✓ Deshabilitar botón + cuando se alcanza el stock máximo
✓ Validar en handleAddToCart que no se compre más de lo disponible
```

**[src/components/islands/CartSlideOver.tsx](src/components/islands/CartSlideOver.tsx)**
```
✓ Mostrar stock disponible de la talla: "3 / 5" (actual / máximo)
✓ Deshabilitar botón + cuando se alcanza el máximo
✓ Permitir solo incrementar hasta el stock disponible
✓ Validación en tiempo real
```

#### 2. Visibilidad de Productos

**[src/pages/productos/index.astro](src/pages/productos/index.astro)**
```
✓ Filtro gt('stock', 0) - Solo mostrar productos con stock total > 0
```

**[src/pages/categoria/[slug].astro](src/pages/categoria/[slug].astro)**
```
✓ Filtro gt('stock', 0) - Solo mostrar productos con stock en categorías
```

**[src/pages/index.astro](src/pages/index.astro)**
```
✓ Filtro gt('stock', 0) - Solo mostrar productos destacados con stock
```

### Cómo Funciona Ahora

#### Escenario Ejemplo: Compra de Tallas

**ANTES (Sin implementación):**
```
Producto: Air Jordan 1 Chicago
- Stock global: 3
- Usuario ve: [41] [42] [43] [40] [45] ... (TODAS LAS TALLAS)
- Compra: 2 pares talla 41
- Sistema: Resta solo del stock total (3 → 1)
- Problema: Usuario no sabe si quedan pares en esa talla específica
```

**AHORA (Con implementación):**
```
Producto: Air Jordan 1 Chicago
Inventario Actual:
- Talla 41: 2 pares ✓ VISIBLE
- Talla 43: 1 par ✓ VISIBLE
- Talla 42: 0 pares ✗ NO APARECE
- Talla 40: 0 pares ✗ NO APARECE

Usuario SOLO VE: [41] [43]
Usuario NO PUEDE elegir: 40, 42, 44, 45, etc.

Usuario selecciona Talla 41:
- Label muestra: "Cantidad (Máximo: 2 pares)"
- Puede comprar: 1 o 2 pares
- Botón + está activo
- Si intenta agregar más: Se bloquea

Usuario compra: 1 par talla 41
- Webhook Stripe procesa
- Stock se actualiza:
  * Talla 41: 2 → 1 ✓
  * Stock total: 3 → 2 ✓

Usuario 2 Ahora Ve:
- Usuario ve [41] [43] (talla 41 sigue visible con 1 par)

Si se vende el último par talla 41:
- Talla 41: 1 → 0
- Talla 41: ✗ DESAPARECE de opciones
- Si stock de todas tallas = 0: Producto DESAPARECE del catálogo
```

### Validaciones Implementadas

✅ **En AddToCartButton:**
- Limitar cantidad según stock de talla seleccionada
- Mostrar cantidad máxima disponible
- Validar al hacer click en "Añadir al carrito"

✅ **En CartSlideOver:**
- Mostrar stock actual/máximo de cada talla
- Deshabilitar incremento cuando se alcanza máximo
- Indicador visual de límite

✅ **En Visibilidad de Catálogo:**
- Filtro gt('stock', 0) en página de productos
- Filtro gt('stock', 0) en página de categorías
- Filtro gt('stock', 0) en homepage

✅ **En Checkout (Existente):**
- Ya implementado: Webhook Stripe descuenta por talla
- Ya implementado: Recalcula stock total correctamente

### Estructura de Datos

El sistema usa `sizes_available` como JSON:
```json
{
  "36": 0,
  "37": 0,
  "38": 0,
  "39": 0,
  "40": 0,
  "41": 2,
  "42": 0,
  "43": 1,
  "44": 0,
  "45": 0
}
```

**Reglas:**
- `qty > 0`: Talla VISIBLE en tienda
- `qty = 0`: Talla OCULTA en tienda
- `SUM(all qty) = 0`: Producto OCULTO en catálogo
- Cada compra descuenta de la talla específica

---

### Testing Checklist

Para verificar que todo funciona:

1. **Crear producto de prueba:**
   - Talla 41: 2 pares
   - Talla 43: 1 par
   - Talla 42: 0 pares
   - Stock total: 3

2. **En tienda pública:**
   - ✓ Solo ve tallas 41 y 43
   - ✓ Talla 41 muestra "(2)"
   - ✓ Talla 43 muestra "(1)"
   - ✓ Al seleccionar talla 41, label dice "Máximo: 2 pares"
   - ✓ Botón + deshabilitado después de cantidad 2

3. **En carrito:**
   - ✓ Muestra "1 / 2" para talla 41
   - ✓ Muestra "1 / 1" para talla 43
   - ✓ Botón + deshabilitado cuando alcanza máximo

4. **Completar compra:**
   - ✓ Compra 1 par talla 41
   - ✓ Stock se actualiza correctamente
   - ✓ Talla 41 ahora muestra 1 disponible
   - ✓ Talla 43 sigue mostrando 1 disponible

5. **Agotamiento:**
   - ✓ Compra el último par talla 43
   - ✓ Talla 43 desaparece de opciones
   - ✓ Solo queda talla 41

6. **Agotamiento total:**
   - ✓ Compra el último par talla 41
   - ✓ Producto desaparece del catálogo

---

## 🔍 Archivos Modificados

1. `src/components/islands/AddToCartButton.tsx` - Validación de stock por talla
2. `src/components/islands/CartSlideOver.tsx` - Indicadores de stock y límites
3. `src/pages/productos/index.astro` - Filtro de stock
4. `src/pages/categoria/[slug].astro` - Filtro de stock en categorías
5. `src/pages/index.astro` - Filtro de stock en homepage

---

## 📋 Próximos Pasos (Opcional)

Mejoras futuras posibles:
- [ ] Email de alerta cuando stock baja de 3
- [ ] Dashboard de admin mostrando "Tallas a agotar pronto"
- [ ] Historial de cambios de stock
- [ ] Notificación "De vuelta en stock" si se reabastece
- [ ] Estadísticas de qué tallas se venden más

---
