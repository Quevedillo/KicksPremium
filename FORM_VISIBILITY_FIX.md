# Fix: Form Input Text Visibility in Admin Panel

## Problema
El texto en los campos de formulario del panel de administración no era visible cuando escribía. El texto estaba ahí (seleccionable) pero no se veía debido a colores de texto incorrectos.

## Causa
Los campos de entrada (inputs, textareas, selects) no tenían clases de color de texto explícitas, lo que causaba que el navegador usara colores que no contrastaban con el fondo blanco.

## Solución Aplicada
Se agregaron las siguientes clases Tailwind a TODOS los inputs, textareas y selects en el panel admin:

```css
bg-white          /* Fondo blanco explícito */
text-brand-black  /* Texto en negro para contraste */
placeholder-neutral-400  /* Placeholders en gris */
```

## Archivos Modificados

### Productos
- **src/pages/admin/productos/nuevo.astro**
  - Campo: name, slug, category_id, description, price, compare_price, stock, sku, material, brand, color
  - Script: Mejorado manejo de checkboxes con `formData.has()` en lugar de `formData.get() === 'on'`
  - Script: Agregado `.trim()` a todos los valores de texto

- **src/pages/admin/productos/[slug]/editar.astro**
  - Campos: name, slug, category_id, description, price, compare_price, stock, sku, material, brand, color
  - Todos los campos ahora tienen color visible

- **src/pages/admin/productos/index.astro**
  - Búsqueda y filtros: search, category select, stock select

### Categorías
- **src/pages/admin/categorias/index.astro**
  - Modal form: name, slug, description, icon, display_order

### Pedidos
- **src/pages/admin/pedidos/index.astro**
  - Búsqueda y filtros: search input, status select

## Commits Realizados
1. `33f6c7a90`: Fix form input text visibility and improve product creation form handling
2. `f38c0d936`: Fix text visibility in all admin forms across the application

## Pruebas Recomendadas
1. Navega a `/admin/productos/nuevo` y verifica que puedas ver el texto mientras escribes
2. Intenta crear un producto y verifica que se envíe correctamente
3. Edita un producto existente en `/admin/productos/[slug]/editar`
4. Prueba buscar productos en `/admin/productos`
5. Verifica que las categorías se pueden crear y editar
6. Comprueba que los pedidos se pueden filtrar correctamente

## Status
✅ Completado - Todos los formularios ahora tienen texto visible
