# 📄 Guía de Personalización de Página - KicksPremium

## 📍 Ubicación en la Interfaz
- **Admin → Personalización** (`/admin/personalizacion`)
- Componente: [PageCustomizer.tsx](src/components/islands/PageCustomizer.tsx)

---

## 🎯 Propósito General

El **Page Customizer** permite a los administradores **armar dinámicamente** la página de inicio (`/`) del sitio sin necesidad de código. Puedes agregar, editar, reordenar y ocultar/mostrar secciones.

---

## 📊 Estructura Base de Datos

### Tabla: `page_sections`
```sql
CREATE TABLE public.page_sections (
  id UUID PRIMARY KEY,
  section_type TEXT NOT NULL,      -- Tipo de sección (hero, featured_products, etc)
  title TEXT,                       -- Título visible
  subtitle TEXT,                    -- Subtítulo
  content JSONB DEFAULT '{}',      -- Datos específicos de cada tipo
  display_order INTEGER NOT NULL,   -- Orden de visualización
  is_visible BOOLEAN DEFAULT TRUE,  -- Mostrar/Ocultar sección
  settings JSONB DEFAULT '{}',     -- Configuración adicional
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Tabla: `featured_product_selections`
```sql
CREATE TABLE public.featured_product_selections (
  id UUID PRIMARY KEY,
  section_id UUID REFERENCES page_sections(id),
  product_id UUID REFERENCES products(id),
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP,
  UNIQUE(section_id, product_id)  -- No duplicados
);
```

---

## 🎨 Tipos de Secciones Disponibles

### 1️⃣ **Hero Banner** 🎯
Banner principal de la página (encabezado grande)

**Campos configurables:**
- `title`: Texto principal
- `subtitle`: Texto secundario
- `content.background_image`: Imagen de fondo (URL)
- `content.cta_button`: Botón de llamada a acción
- `content.cta_link`: Enlace del botón

**Almacenamiento:**
```json
{
  "section_type": "hero",
  "title": "Sneakers Exclusivos",
  "subtitle": "Ediciones limitadas y auténticas",
  "content": {
    "background_image": "https://...",
    "cta_button": "Ver Colección",
    "cta_link": "/categoria/ediciones-limitadas"
  }
}
```

---

### 2️⃣ **Barra de Marcas** 🏷️
Widget que muestra logos/nombres de marcas disponibles

**Datos fuente:**
- Se conecta directamente con tabla `brands`
- Muestra los logos configurados
- Ordena por `display_order`

**Campos configurables:**
- `title`: "Marcas destacadas"
- `settings.show_logos`: Mostrar imágenes (bool)
- `settings.columns`: Cantidad de columnas

---

### 3️⃣ **Colecciones/Categorías** 📦
Grid de categorías disponibles

**Datos fuente:**
- Tabla `categories`
- Muestra icon, nombre, descripción

**Campos configurables:**
- `title`: "Nuestras Colecciones"
- `settings.columns`: Columnas en grid (3, 4, etc)
- `settings.show_count`: Mostrar contador de productos

---

### 4️⃣ **Productos Destacados** ⭐
**Es la más importante para control de inventario**

Tu seleccionas manualmente qué productos aparecen aquí

**Flujo:**
1. Admin abre página de Personalización
2. Crea/edita sección "Productos Destacados"
3. Hace clic en "Seleccionar Productos"
4. Se abre modal con búsqueda/filtros
5. Elige productos → se guardan en `featured_product_selections`
6. Arrastra para cambiar orden
7. Los productos aparecen en `/` en el orden especificado

**Dados almacenados:**
```json
{
  "section_type": "featured_products",
  "title": "Lo Más Vendido",
  "content": {},
  "settings": {
    "columns": 4,
    "show_price": true,
    "show_stock": true
  }
}

// En featured_product_selections:
{
  "section_id": "uuid-de-seccion",
  "product_id": "uuid-producto-1",
  "display_order": 1
},
{
  "section_id": "uuid-de-seccion", 
  "product_id": "uuid-producto-2",
  "display_order": 2
}
```

---

### 5️⃣ **Productos Personalizados** 🛍️
Similar a "Destacados" pero con nombre específico

**Caso de uso:**
- "Nuevos Lanzamientos"
- "Mejores Ofertas"
- "Colección Acotada"

---

### 6️⃣ **Banner Promocional** 📣
Banner intermedio en la página

**Campos configurables:**
- `title`: Texto principal
- `content.text`: Descripción
- `content.image`: Imagen
- `content.button_text`: Botón
- `content.button_link`: Enlace

**Ejemplo:**
```json
{
  "section_type": "banner",
  "title": "Descuento Especial",
  "content": {
    "text": "Usa WELCOME10 para 10% off",
    "image": "https://...",
    "button_text": "Ver Más",
    "button_link": "/descuentos"
  }
}
```

---

### 7️⃣ **Newsletter** 📧
Formulario de suscripción integrado

**Datos fuente:**
- Se conecta con `/api/newsletter/subscribe`
- Almacena en tabla `newsletter_subscribers`

**Campos configurables:**
- `title`: "Suscríbete a nuestro Newsletter"
- `content.placeholder`: Texto en campo de email
- `content.button_text`: Texto del botón

---

## 🔄 Flujo de Funcionamiento

### 1. **Carga Inicial**
```
GET /api/admin/page-sections
↓
Retorna:
- sections[] → Todas las secciones creadas
- products[] → Todos los productos (para búsqueda)
- selections[] → Productos asignados a cada sección
```

### 2. **Crear Sección**
```
POST /api/admin/page-sections
{
  "section_type": "featured_products",
  "title": "Nuevos Lanzamientos",
  "display_order": 3,
  "is_visible": true
}
↓
Retorna nueva sección con ID
```

### 3. **Editar Sección**
```
PUT /api/admin/page-sections
{
  "id": "section-uuid",
  "title": "Nuevo título",
  "is_visible": false
}
```

### 4. **Reordenar Secciones**
```
Al arrastrar sección hacia arriba/abajo:
- Se obtiene el nuevo display_order
- PATCH /api/admin/page-sections
{
  "id": "section-uuid",
  "display_order": 2
}
```

### 5. **Agregar Productos a Sección**
```
POST /api/admin/page-sections/[id]/products
{
  "product_id": "product-uuid"
}
↓
Se crea fila en featured_product_selections
```

### 6. **Buscar Productos**
```
La búsqueda es local (en el frontend)
- Filtra por nombre, brand, SKU
- Muestra en tiempo real
```

---

## 🖼️ Cómo se Visualiza en la Página Principal

La página `/` renderiza dinámicamente:

```astro
<!-- En src/pages/index.astro -->

{sections.map(section => (
  {section.is_visible && (
    {section.section_type === 'hero' && <HeroSection data={section} />}
    {section.section_type === 'featured_products' && 
      <FeaturedProducts data={section} products={getProducts(section.id)} />
    }
    {section.section_type === 'banner' && <BannerSection data={section} />}
    {/* etc... */}
  )}
))}
```

**Orden:** Respeta el campo `display_order`

---

## 🎮 Acciones Disponibles en la UI

### En Cada Sección:

| Acción | Efecto |
|--------|--------|
| 👁️ Ojo | Toggle `is_visible` (mostrar/ocultar) |
| ✏️ Editar | Abre modal de edición |
| 🔼/🔽 Flechas | Cambia `display_order` |
| 🗑️ Papelera | Elimina la sección |

### En Productos Destacados:

| Acción | Efecto |
|--------|--------|
| ➕ Agregar | Abre modal de búsqueda/selección |
| ↕️ Arrastrar | Cambia orden en `featured_product_selections` |
| 🗑️ Eliminar | Quita producto de la sección |

---

## 📋 Endpoints API

### GET `/api/admin/page-sections`
Obtiene todas las secciones, productos y selecciones

**Respuesta:**
```json
{
  "sections": [
    {
      "id": "uuid",
      "section_type": "featured_products",
      "title": "Lo Más Vendido",
      "display_order": 2,
      "is_visible": true
    }
  ],
  "products": [
    {
      "id": "uuid",
      "name": "Air Jordan 1",
      "price": 15000,
      "brand": "Jordan",
      "images": ["url1", "url2"]
    }
  ],
  "selections": [
    {
      "id": "uuid",
      "section_id": "uuid-section",
      "product_id": "uuid-product",
      "display_order": 1
    }
  ]
}
```

### POST `/api/admin/page-sections`
Crea nueva sección

```json
{
  "section_type": "featured_products",
  "title": "Nuevos Lanzamientos",
  "display_order": 5,
  "is_visible": true,
  "content": {},
  "settings": {}
}
```

### PUT `/api/admin/page-sections`
Actualiza sección existente

```json
{
  "id": "section-uuid",
  "title": "Nuevo Título",
  "is_visible": false,
  "display_order": 3
}
```

### DELETE `/api/admin/page-sections/[id]`
Elimina sección y todas sus selecciones de productos

### POST `/api/admin/page-sections/[id]/products`
Agrega producto a sección

```json
{
  "product_id": "product-uuid"
}
```

### PUT `/api/admin/page-sections/[id]/products`
Reordena productos en sección

```json
{
  "products": [
    { "product_id": "uuid1", "display_order": 1 },
    { "product_id": "uuid2", "display_order": 2 }
  ]
}
```

### DELETE `/api/admin/page-sections/[id]/products/[product_id]`
Quita producto de sección

---

## 🔐 Seguridad (RLS)

Las políticas de acceso en `page_sections` y `featured_product_selections`:

```sql
-- Públicos pueden leer
CREATE POLICY "public_read_sections" 
  FOR SELECT USING (true);

-- Solo admins pueden modificar
CREATE POLICY "admins_manage_sections" 
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_admin = true
  ));
```

---

## 💡 Casos de Uso Prácticos

### Caso 1: Destacar Productos Nuevos
1. Admin crea sección "Nuevos Lanzamientos"
2. Tipo: "featured_products"
3. Agrega los 8 productos nuevos en orden
4. Los ve el usuario en `/` automáticamente

### Caso 2: En Descuento
1. Admin crea sección "Ofertas Especiales"
2. Selecciona productos con descuento
3. Mueve la sección al top (display_order = 1)
4. Los usuarios ven ofertas primero

### Caso 3: Limpiar Página
1. Admin quiere sacar sección temporalmente
2. Hace clic en 👁️ (toggles is_visible = false)
3. **No se elimina**, solo se oculta
4. Puede reactivarla después sin perder datos

### Caso 4: Reorganizar Secciones
1. Admin nota que ofertas están abajo
2. Arrastra sección hacia arriba
3. `display_order` se actualiza
4. Los cambios son inmediatos en `/`

---

## ⚠️ Limitaciones Actuales

1. **Sin imágenes personalizadas** - Las imágenes vienen de los productos
2. **Sin estilos CSS** - Cada tipo de sección tiene estilo fijo
3. **Sin vista previa** - No ves cómo se ve mientras editas
4. **Máximo de secciones** - Sin límite técnico, pero UX puede ser lenta con +50

---

## 🚀 Mejoras Futuras

- [ ] Vista previa en tiempo real
- [ ] Editor de estilos CSS
- [ ] Imágenes personalizadas por sección
- [ ] Plantillas predefinidas
- [ ] Historial de cambios
- [ ] Programación de secciones (fecha inicio/fin)

---

## 📞 Troubleshooting

### P: Los cambios no se guardan
**R:** Verifica que estés autenticado como admin. Revisa la consola para errores. Intenta refrescar.

### P: Los productos no aparecen en la página
**R:** Verifica que `is_visible = true` en la sección. Asegúrate de que los productos estén en `featured_product_selections`.

### P: El orden de productos no se mantiene
**R:** Verifica el `display_order`. Si es igual para dos productos, el orden es indefinido. Edita uno.

### P: No puedo agregar productos
**R:** Solo admins pueden hacerlo. Verifica que tu cuenta tenga `is_admin = true`.

---

**Última actualización:** Febrero 2026  
**Versión del sistema:** KicksPremium v2.0
