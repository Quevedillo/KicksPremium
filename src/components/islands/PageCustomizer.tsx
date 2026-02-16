import React, { useEffect, useState, useCallback, useRef } from 'react';

interface PageSection {
  id: string;
  section_type: string;
  title: string;
  subtitle: string;
  content: any;
  display_order: number;
  is_visible: boolean;
  settings: any;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  images: string[];
  stock: number;
  is_limited_edition?: boolean;
}

interface FeaturedSelection {
  id: string;
  section_id: string;
  product_id: string;
  display_order: number;
  products: Product;
}

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Banner', icon: '??', description: 'Banner principal de la pagina' },
  { value: 'brands_bar', label: 'Barra de Marcas', icon: '???', description: 'Barra con nombres de marcas' },
  { value: 'categories', label: 'Colecciones', icon: '??', description: 'Grid de categorias' },
  { value: 'featured_products', label: 'Productos Destacados', icon: '?', description: 'Productos seleccionados manualmente' },
  { value: 'custom_products', label: 'Productos Personalizados', icon: '???', description: 'Seleccion personalizada de productos' },
  { value: 'banner', label: 'Banner Promocional', icon: '??', description: 'Banner de promocion o anuncio' },
  { value: 'newsletter', label: 'Newsletter', icon: '??', description: 'Formulario de suscripcion' },
];

export default function PageCustomizer() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selections, setSelections] = useState<FeaturedSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activePanel, setActivePanel] = useState<'sections' | 'editor'>('sections');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/page-sections');
      if (!res.ok) throw new Error('Error loading data');
      const data = await res.json();
      setSections(data.sections || []);
      setProducts(data.products || []);
      setSelections(data.selections || []);
    } catch (error) {
      console.error('Error loading page sections:', error);
      showMsg('Error cargando secciones', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const refreshPreview = () => {
    if (previewRef.current) {
      previewRef.current.src = previewRef.current.src;
    }
  };

  const toggleVisibility = async (section: PageSection) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: section.id, is_visible: !section.is_visible }),
      });
      if (res.ok) {
        setSections(prev => prev.map(s =>
          s.id === section.id ? { ...s, is_visible: !s.is_visible } : s
        ));
        showMsg(`Seccion ${!section.is_visible ? 'visible' : 'oculta'}`, 'success');
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      showMsg('Error actualizando visibilidad', 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveSection = async (sectionId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === sectionId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sections.length - 1)) return;

    const newSections = [...sections];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];

    const reorder = newSections.map((s, i) => ({ id: s.id, display_order: i + 1 }));
    setSections(newSections.map((s, i) => ({ ...s, display_order: i + 1 })));

    try {
      await fetch('/api/admin/page-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder }),
      });
      showMsg('Orden actualizado', 'success');
      setHasUnsavedChanges(true);
    } catch (error) {
      showMsg('Error actualizando orden', 'error');
      loadData();
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Seguro que quieres eliminar esta seccion?')) return;
    
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sectionId }),
      });
      if (res.ok) {
        setSections(prev => prev.filter(s => s.id !== sectionId));
        if (editingSection?.id === sectionId) {
          setEditingSection(null);
          setActivePanel('sections');
        }
        showMsg('Seccion eliminada', 'success');
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      showMsg('Error eliminando seccion', 'error');
    }
  };

  const addSection = async (type: string) => {
    const typeInfo = SECTION_TYPES.find(t => t.value === type);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_type: type,
          title: typeInfo?.label || 'Nueva seccion',
          subtitle: '',
          display_order: sections.length + 1,
          is_visible: true,
          content: {},
          settings: {},
        }),
      });
      if (res.ok) {
        await loadData();
        setShowAddModal(false);
        showMsg('Seccion anadida', 'success');
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      showMsg('Error anadiendo seccion', 'error');
    }
  };

  const saveSection = async () => {
    if (!editingSection) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSection.id,
          title: editingSection.title,
          subtitle: editingSection.subtitle,
          content: editingSection.content,
          settings: editingSection.settings,
          product_ids: selectedProducts,
        }),
      });
      if (res.ok) {
        await loadData();
        showMsg('Seccion guardada', 'success');
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      showMsg('Error guardando seccion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const publishChanges = () => {
    refreshPreview();
    setHasUnsavedChanges(false);
    showMsg('Cambios publicados', 'success');
  };

  const openEditor = (section: PageSection) => {
    setEditingSection({ ...section });
    const sectionSelections = selections
      .filter(s => s.section_id === section.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map(s => s.product_id);
    setSelectedProducts(sectionSelections);
    setActivePanel('editor');
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.brand.toLowerCase().includes(productSearch.toLowerCase())
  );

  const getSectionIcon = (type: string) =>
    SECTION_TYPES.find(t => t.value === type)?.icon || '??';

  const getSectionLabel = (type: string) =>
    SECTION_TYPES.find(t => t.value === type)?.label || type;

  // Drag and drop handlers
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const newSections = [...sections];
    const [dragged] = newSections.splice(draggedIdx, 1);
    newSections.splice(idx, 0, dragged);

    const reorder = newSections.map((s, i) => ({ id: s.id, display_order: i + 1 }));
    setSections(newSections.map((s, i) => ({ ...s, display_order: i + 1 })));
    setDraggedIdx(null);
    setDragOverIdx(null);

    try {
      await fetch('/api/admin/page-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder }),
      });
      showMsg('Orden actualizado', 'success');
      setHasUnsavedChanges(true);
    } catch (error) {
      showMsg('Error actualizando orden', 'error');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-neutral-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
          <p className="mt-4 text-neutral-400">Cargando personalizador...</p>
        </div>
      </div>
    );
  }

  // Preview miniature for sections
  const SectionPreview = ({ section }: { section: PageSection }) => {
    const previewStyles: Record<string, { bg: string; preview: React.ReactNode }> = {
      hero: {
        bg: 'bg-gradient-to-br from-neutral-900 to-neutral-800',
        preview: (
          <div className="p-2 text-white">
            <div className="w-8 h-1 bg-red-500 rounded mb-1"></div>
            <div className="w-14 h-1.5 bg-white/80 rounded mb-0.5"></div>
            <div className="w-10 h-1 bg-white/40 rounded mb-1.5"></div>
            <div className="flex gap-0.5">
              <div className="w-6 h-2 bg-red-500 rounded-sm"></div>
              <div className="w-6 h-2 border border-white/40 rounded-sm"></div>
            </div>
          </div>
        )
      },
      brands_bar: {
        bg: 'bg-neutral-800',
        preview: (
          <div className="p-2 flex items-center justify-center gap-2">
            {['N', 'J', 'A'].map(b => (
              <span key={b} className="text-[6px] text-neutral-400 font-bold">{b}</span>
            ))}
          </div>
        )
      },
      categories: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-1.5 grid grid-cols-3 gap-0.5">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-square bg-neutral-700 rounded-sm"></div>
            ))}
          </div>
        )
      },
      featured_products: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-1.5">
            <div className="w-8 h-0.5 bg-red-500/60 rounded mb-1 mx-auto"></div>
            <div className="grid grid-cols-3 gap-0.5">
              {[1,2,3].map(i => (
                <div key={i} className="bg-neutral-800 rounded-sm p-0.5">
                  <div className="aspect-square bg-neutral-700 rounded-sm"></div>
                </div>
              ))}
            </div>
          </div>
        )
      },
      custom_products: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-1.5">
            <div className="grid grid-cols-3 gap-0.5">
              {[1,2,3].map(i => (
                <div key={i} className="aspect-square bg-neutral-800 rounded-sm"></div>
              ))}
            </div>
          </div>
        )
      },
      banner: {
        bg: 'bg-gradient-to-r from-red-600 to-red-500',
        preview: (
          <div className="p-2 flex items-center justify-between">
            <div className="w-10 h-1 bg-white/80 rounded"></div>
            <div className="w-5 h-2 bg-white rounded-sm"></div>
          </div>
        )
      },
      newsletter: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-2 text-center">
            <div className="w-10 h-1 bg-white/60 rounded mb-1 mx-auto"></div>
            <div className="flex gap-0.5 justify-center">
              <div className="w-10 h-2 bg-neutral-700 rounded-sm"></div>
              <div className="w-5 h-2 bg-red-500 rounded-sm"></div>
            </div>
          </div>
        )
      }
    };

    const style = previewStyles[section.section_type] || previewStyles.banner;
    return (
      <div className={`${style.bg} rounded overflow-hidden w-full h-10 flex-shrink-0`}>
        {style.preview}
      </div>
    );
  };

  // Editor panel for each section type
  const renderSectionEditor = () => {
    if (!editingSection) return null;

    return (
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Titulo</label>
          <input
            type="text"
            value={editingSection.title || ''}
            onChange={e => setEditingSection({ ...editingSection, title: e.target.value })}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Subtitulo</label>
          <textarea
            value={editingSection.subtitle || ''}
            onChange={e => setEditingSection({ ...editingSection, subtitle: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red resize-none"
          />
        </div>

        {/* Hero specific */}
        {editingSection.section_type === 'hero' && (
          <div className="space-y-3 bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
            <h4 className="text-xs font-bold text-brand-red uppercase tracking-wider">Configuracion Hero</h4>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Badge (etiqueta superior)</label>
              <input
                type="text"
                value={editingSection.content?.badge || ''}
                onChange={e => setEditingSection({
                  ...editingSection,
                  content: { ...editingSection.content, badge: e.target.value }
                })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                placeholder="Ej: Exclusively Limited"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Boton - Texto</label>
                <input
                  type="text"
                  value={editingSection.content?.cta_primary?.text || ''}
                  onChange={e => setEditingSection({
                    ...editingSection,
                    content: {
                      ...editingSection.content,
                      cta_primary: { ...editingSection.content?.cta_primary, text: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Boton - URL</label>
                <input
                  type="text"
                  value={editingSection.content?.cta_primary?.url || ''}
                  onChange={e => setEditingSection({
                    ...editingSection,
                    content: {
                      ...editingSection.content,
                      cta_primary: { ...editingSection.content?.cta_primary, url: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Brands bar */}
        {editingSection.section_type === 'brands_bar' && (
          <div className="space-y-3 bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
            <h4 className="text-xs font-bold text-brand-red uppercase tracking-wider">Marcas</h4>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Marcas (separadas por coma)</label>
              <input
                type="text"
                value={(editingSection.content?.brands || []).join(', ')}
                onChange={e => setEditingSection({
                  ...editingSection,
                  content: { ...editingSection.content, brands: e.target.value.split(',').map((b: string) => b.trim()) }
                })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                placeholder="Travis Scott, Jordan, Nike, Adidas"
              />
            </div>
          </div>
        )}

        {/* Banner */}
        {editingSection.section_type === 'banner' && (
          <div className="space-y-3 bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
            <h4 className="text-xs font-bold text-brand-red uppercase tracking-wider">Banner</h4>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">URL del enlace</label>
              <input
                type="text"
                value={editingSection.content?.link_url || ''}
                onChange={e => setEditingSection({
                  ...editingSection,
                  content: { ...editingSection.content, link_url: e.target.value }
                })}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                placeholder="/productos"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Color de fondo</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { value: 'brand-red', label: 'Rojo', color: 'bg-red-600' },
                  { value: 'brand-black', label: 'Negro', color: 'bg-neutral-900' },
                  { value: 'brand-dark', label: 'Oscuro', color: 'bg-neutral-700' },
                  { value: 'white', label: 'Blanco', color: 'bg-white' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditingSection({
                      ...editingSection,
                      settings: { ...editingSection.settings, bg_color: opt.value }
                    })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      (editingSection.settings?.bg_color || 'brand-red') === opt.value
                        ? 'border-brand-red ring-1 ring-brand-red/30 bg-neutral-800'
                        : 'border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full ${opt.color} border border-neutral-600`}></div>
                    <span className="text-[9px] text-neutral-400">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Product sections */}
        {(editingSection.section_type === 'featured_products' || editingSection.section_type === 'custom_products') && (
          <div className="space-y-3 bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-brand-red uppercase tracking-wider flex items-center gap-1.5">
                Productos
                <span className="bg-brand-red text-white text-[10px] px-1.5 py-0.5 rounded-full">{selectedProducts.length}</span>
              </h4>
            </div>

            {/* Selected products grid */}
            {selectedProducts.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5">
                {selectedProducts.map(pid => {
                  const prod = products.find(p => p.id === pid);
                  if (!prod) return null;
                  return (
                    <div key={pid} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800">
                        {prod.images?.[0] ? (
                          <img src={prod.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">??</div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleProductSelection(pid)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >x</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Product search/picker */}
            <div>
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 placeholder-neutral-500"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-thin">
              {filteredProducts.slice(0, 20).map(product => (
                <label
                  key={product.id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm ${
                    selectedProducts.includes(product.id)
                      ? 'bg-brand-red/10 border border-brand-red/30'
                      : 'hover:bg-neutral-800 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => toggleProductSelection(product.id)}
                    className="rounded text-brand-red focus:ring-brand-red accent-red-500 w-3.5 h-3.5"
                  />
                  {product.images?.[0] && (
                    <img src={product.images[0]} alt="" className="w-7 h-7 rounded object-cover border border-neutral-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{product.brand} - {product.name}</p>
                    <p className="text-[10px] text-neutral-500">{(product.price / 100).toFixed(2)} EUR</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-400">Max productos:</label>
              <input
                type="number"
                min={1}
                max={24}
                value={editingSection.content?.max_products || 6}
                onChange={e => setEditingSection({
                  ...editingSection,
                  content: { ...editingSection.content, max_products: parseInt(e.target.value) || 6 }
                })}
                className="w-16 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-brand-red/50"
              />
            </div>
          </div>
        )}

        {/* Layout settings */}
        <div className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Diseno</h4>
          <label className="block text-xs text-neutral-400 mb-1.5">Columnas (desktop)</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[2, 3, 4, 6].map(cols => (
              <button
                key={cols}
                type="button"
                onClick={() => setEditingSection({
                  ...editingSection,
                  settings: { ...editingSection.settings, columns: cols }
                })}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                  (editingSection.settings?.columns || 3) === cols
                    ? 'border-brand-red ring-1 ring-brand-red/30 bg-neutral-800'
                    : 'border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
                    <div key={i} className={`h-4 rounded-sm ${(editingSection.settings?.columns || 3) === cols ? 'bg-brand-red' : 'bg-neutral-600'}`} style={{ width: `${20 / cols}px` }}></div>
                  ))}
                </div>
                <span className="text-[10px] text-neutral-400">{cols} col</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={saveSection}
          disabled={saving}
          className="w-full py-2.5 bg-brand-red text-white text-sm font-bold rounded-lg hover:bg-brand-orange transition-all disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    );
  };

  return (
    <div className="h-screen md:h-[calc(100vh-80px)] flex flex-col bg-neutral-950 -m-6 md:-m-6 -mt-4">
      {/* Top toolbar - WordPress style */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-3 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-white transition-colors rounded"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span className="text-white font-bold text-sm hidden sm:inline">Personalizador</span>
          </div>
          
          {/* Stats pills */}
          <div className="hidden lg:flex items-center gap-2 ml-4">
            <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded-full border border-neutral-700">
              {sections.length} secciones
            </span>
            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">
              {sections.filter(s => s.is_visible).length} visibles
            </span>
            <span className="hidden xl:inline-block px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20">
              {selections.length} productos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-400 animate-pulse mr-2 hidden sm:inline">Cambios sin publicar</span>
          )}
          <button
            onClick={publishChanges}
            className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              hasUnsavedChanges
                ? 'bg-brand-red text-white hover:bg-brand-orange shadow-lg shadow-red-500/20'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Publicar</span>
          </button>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-xl animate-slideDown ${
          message.type === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {message.type === 'success' ? '?' : '?'} {message.text}
        </div>
      )}

      {/* Main content - WordPress customizer layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* LEFT SIDEBAR - Controls panel */}
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-80 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 flex-col overflow-hidden flex-shrink-0 transition-all duration-300`}>
          
          {/* Panel tabs */}
          <div className="flex border-b border-neutral-800 bg-neutral-800/50">
            <button
              onClick={() => setActivePanel('sections')}
              className={`flex-1 px-2 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${
                activePanel === 'sections'
                  ? 'text-brand-red border-b-2 border-brand-red bg-neutral-800/50'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Secciones
            </button>
            <button
              onClick={() => setActivePanel('editor')}
              className={`flex-1 px-2 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${
                activePanel === 'editor'
                  ? 'text-brand-red border-b-2 border-brand-red bg-neutral-800/50'
                  : 'text-neutral-500 hover:text-neutral-300'
              } ${!editingSection ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={!editingSection}
            >
              Editor
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {activePanel === 'sections' && (
              <div className="p-2 md:p-3 space-y-1 md:space-y-2">
                {/* Add section button */}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full py-2 md:py-2.5 border-2 border-dashed border-neutral-700 text-neutral-400 text-xs md:text-sm font-medium rounded-lg hover:border-brand-red hover:text-brand-red transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Anadir Seccion</span>
                  <span className="sm:hidden">Anadir</span>
                </button>

                {/* Section list with drag and drop */}
                {sections.map((section, idx) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                    className={`group rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                      dragOverIdx === idx ? 'border-brand-red bg-brand-red/5' : ''
                    } ${draggedIdx === idx ? 'opacity-50' : ''} ${
                      editingSection?.id === section.id
                        ? 'border-brand-red bg-brand-red/5'
                        : section.is_visible
                        ? 'border-neutral-800 bg-neutral-800/50 hover:border-neutral-700'
                        : 'border-neutral-800 bg-neutral-900/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 md:gap-2.5 p-2 md:p-2.5">
                      {/* Drag handle */}
                      <div className="flex flex-col items-center gap-0.5 text-neutral-600 group-hover:text-neutral-400 transition-colors cursor-grab hidden sm:flex">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="6" r="1.5" />
                          <circle cx="15" cy="6" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="18" r="1.5" />
                          <circle cx="15" cy="18" r="1.5" />
                        </svg>
                      </div>

                      {/* Mini preview */}
                      <div className="w-10 md:w-14 flex-shrink-0">
                        <SectionPreview section={section} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm md:text-base">{getSectionIcon(section.section_type)}</span>
                          <h3 className="text-[10px] md:text-xs font-bold text-white truncate">{section.title || getSectionLabel(section.section_type)}</h3>
                        </div>
                        <p className="text-[8px] md:text-[10px] text-neutral-500">{getSectionLabel(section.section_type)}</p>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleVisibility(section); }}
                          className={`p-1 rounded transition-colors ${section.is_visible ? 'text-green-400 hover:bg-green-500/10' : 'text-neutral-600 hover:bg-neutral-700'}`}
                          title={section.is_visible ? 'Ocultar' : 'Mostrar'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {section.is_visible ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditor(section); }}
                          className="p-1 rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                          className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {sections.length === 0 && (
                  <div className="text-center py-8 md:py-12">
                    <div className="text-3xl md:text-4xl mb-2 md:mb-3">🎨</div>
                    <p className="text-neutral-400 text-xs md:text-sm font-medium">Pagina vacia</p>
                    <p className="text-neutral-600 text-[10px] md:text-xs mt-1">Anade secciones para disenar tu tienda</p>
                  </div>
                )}
              </div>
            )}

            {activePanel === 'editor' && editingSection && (
              <div className="p-2 md:p-3 space-y-2 md:space-y-4">
                {/* Back button */}
                <button
                  onClick={() => { setActivePanel('sections'); }}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors mb-2 md:mb-3"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Volver a secciones</span>
                  <span className="sm:hidden">Volver</span>
                </button>
                
                {/* Section header */}
                <div className="flex items-center gap-2 mb-3 md:mb-4 pb-2 md:pb-3 border-b border-neutral-800">
                  <span className="text-lg md:text-xl">{getSectionIcon(editingSection.section_type)}</span>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">{getSectionLabel(editingSection.section_type)}</h3>
                    <p className="text-[9px] md:text-[10px] text-neutral-500">Editando seccion</p>
                  </div>
                </div>

                {renderSectionEditor()}
              </div>
            )}

            {activePanel === 'editor' && !editingSection && (
              <div className="p-4 md:p-6 text-center">
                <div className="text-2xl md:text-3xl mb-2">👈</div>
                <p className="text-neutral-400 text-xs md:text-sm">Selecciona una seccion para editar</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT - Live Preview */}
        <div className="flex-1 bg-neutral-950 flex flex-col overflow-hidden min-h-0">
          {/* Preview toolbar */}
          <div className="bg-neutral-900/50 border-b border-neutral-800 px-2 md:px-4 py-1 md:py-1.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1 md:gap-2">
              <div className="flex gap-0.5 md:gap-1">
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-red-500/60"></div>
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-yellow-500/60"></div>
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-green-500/60"></div>
              </div>
              <div className="bg-neutral-800 rounded-md px-2 md:px-3 py-0.5 flex items-center gap-1 md:gap-1.5 border border-neutral-700 hidden sm:flex">
                <svg className="w-2.5 md:w-3 h-2.5 md:h-3 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
                <span className="text-[8px] md:text-[10px] text-neutral-500 truncate">kickspremium.com</span>
              </div>
            </div>
            <button
              onClick={refreshPreview}
              className="p-1 text-neutral-500 hover:text-white transition-colors rounded"
              title="Recargar preview"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {/* Live iframe preview */}
          <div className="flex-1 overflow-hidden bg-neutral-950 p-2 md:p-3">
            <div className="w-full h-full rounded-lg overflow-hidden border border-neutral-800 shadow-2xl">
              <iframe
                ref={previewRef}
                src="/"
                className="w-full h-full bg-white"
                title="Vista previa de la pagina"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Section Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-5 border-b border-neutral-800 sticky top-0 bg-neutral-900">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Anadir Seccion
              </h2>
              <p className="text-xs text-neutral-500 mt-1">Elige un bloque para tu pagina</p>
            </div>
            <div className="p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
              {SECTION_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => addSection(type.value)}
                  className="flex items-center gap-2 md:gap-3 p-3 rounded-xl text-left border border-neutral-800 hover:border-brand-red/30 hover:bg-brand-red/5 transition-all group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform flex-shrink-0">{type.icon}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs md:text-sm">{type.label}</p>
                    <p className="text-[10px] md:text-[11px] text-neutral-500">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 md:p-4 border-t border-neutral-800 sticky bottom-0 bg-neutral-900">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full py-2 text-neutral-500 hover:text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
