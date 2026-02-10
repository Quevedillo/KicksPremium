import React, { useEffect, useState, useCallback } from 'react';

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
  { value: 'hero', label: 'Hero Banner', icon: '🎯', description: 'Banner principal de la página' },
  { value: 'brands_bar', label: 'Barra de Marcas', icon: '🏷️', description: 'Barra con nombres de marcas' },
  { value: 'categories', label: 'Colecciones', icon: '📦', description: 'Grid de categorías' },
  { value: 'featured_products', label: 'Productos Destacados', icon: '⭐', description: 'Productos seleccionados manualmente' },
  { value: 'custom_products', label: 'Productos Personalizados', icon: '🛍️', description: 'Selección personalizada de productos' },
  { value: 'banner', label: 'Banner Promocional', icon: '📣', description: 'Banner de promoción o anuncio' },
  { value: 'newsletter', label: 'Newsletter', icon: '📧', description: 'Formulario de suscripción' },
];

export default function PageCustomizer() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selections, setSelections] = useState<FeaturedSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
      showMessage('Error cargando secciones', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
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
        showMessage(`Sección ${!section.is_visible ? 'visible' : 'oculta'}`, 'success');
      }
    } catch (error) {
      showMessage('Error actualizando visibilidad', 'error');
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
      showMessage('Orden actualizado', 'success');
    } catch (error) {
      showMessage('Error actualizando orden', 'error');
      loadData();
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta sección?')) return;
    
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sectionId }),
      });
      if (res.ok) {
        setSections(prev => prev.filter(s => s.id !== sectionId));
        showMessage('Sección eliminada', 'success');
      }
    } catch (error) {
      showMessage('Error eliminando sección', 'error');
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
          title: typeInfo?.label || 'Nueva sección',
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
        showMessage('Sección añadida', 'success');
      }
    } catch (error) {
      showMessage('Error añadiendo sección', 'error');
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
        setEditingSection(null);
        showMessage('Sección guardada', 'success');
      }
    } catch (error) {
      showMessage('Error guardando sección', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (section: PageSection) => {
    setEditingSection({ ...section });
    const sectionSelections = selections
      .filter(s => s.section_id === section.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map(s => s.product_id);
    setSelectedProducts(sectionSelections);
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

  const getSectionIcon = (type: string) => {
    return SECTION_TYPES.find(t => t.value === type)?.icon || '📄';
  };

  const getSectionLabel = (type: string) => {
    return SECTION_TYPES.find(t => t.value === type)?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
          <p className="mt-4 text-neutral-600">Cargando personalizador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-brand-black">Personalizar Página</h1>
          <p className="text-neutral-500 text-sm mt-1">Arrastra, oculta o edita las secciones de tu tienda</p>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank" className="px-4 py-2 border border-neutral-300 text-neutral-600 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors">
            👁️ Ver Tienda
          </a>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-brand-red text-white text-sm font-semibold rounded-lg hover:bg-brand-orange transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Añadir Sección
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Sections List */}
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <div
            key={section.id}
            className={`bg-white border rounded-xl p-5 transition-all ${
              section.is_visible ? 'border-neutral-200 hover:shadow-md' : 'border-neutral-200 bg-neutral-50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Drag handle & Icon */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveSection(section.id, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSection(section.id, 'down')}
                  disabled={idx === sections.length - 1}
                  className="p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Section Icon */}
              <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                {getSectionIcon(section.section_type)}
              </div>

              {/* Section Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-brand-black">{section.title || getSectionLabel(section.section_type)}</h3>
                  <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">
                    {getSectionLabel(section.section_type)}
                  </span>
                  {!section.is_visible && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full">Oculto</span>
                  )}
                </div>
                {section.subtitle && (
                  <p className="text-sm text-neutral-500 truncate mt-0.5">{section.subtitle}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleVisibility(section)}
                  className={`p-2 rounded-lg transition-colors ${
                    section.is_visible ? 'text-green-600 hover:bg-green-50' : 'text-neutral-400 hover:bg-neutral-100'
                  }`}
                  title={section.is_visible ? 'Ocultar sección' : 'Mostrar sección'}
                >
                  {section.is_visible ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => openEditor(section)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar sección"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteSection(section.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar sección"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Show selected products if any */}
            {(section.section_type === 'featured_products' || section.section_type === 'custom_products') && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="flex flex-wrap gap-2">
                  {selections
                    .filter(s => s.section_id === section.id)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map(sel => (
                      <span key={sel.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full text-xs text-neutral-600">
                        {sel.products?.images?.[0] && (
                          <img src={sel.products.images[0]} alt="" className="w-5 h-5 rounded-full object-cover" />
                        )}
                        {sel.products?.brand} {sel.products?.name?.substring(0, 20)}
                      </span>
                    ))
                  }
                  {selections.filter(s => s.section_id === section.id).length === 0 && (
                    <span className="text-xs text-neutral-400 italic">Sin productos seleccionados (mostrará automáticos)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {sections.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-neutral-300">
            <p className="text-neutral-500 mb-4">No hay secciones configuradas</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-brand-red text-white text-sm font-semibold rounded-lg"
            >
              Añadir primera sección
            </button>
          </div>
        )}
      </div>

      {/* Add Section Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-brand-black">Añadir Sección</h2>
              <p className="text-sm text-neutral-500 mt-1">Elige el tipo de sección que quieres añadir</p>
            </div>
            <div className="p-4 space-y-2">
              {SECTION_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => addSection(type.value)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-colors text-left border border-neutral-100"
                >
                  <span className="text-3xl">{type.icon}</span>
                  <div>
                    <p className="font-semibold text-brand-black">{type.label}</p>
                    <p className="text-sm text-neutral-500">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-neutral-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full py-2 text-neutral-500 hover:text-neutral-700 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingSection(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSectionIcon(editingSection.section_type)}</span>
                <div>
                  <h2 className="text-lg font-bold text-brand-black">Editar: {getSectionLabel(editingSection.section_type)}</h2>
                  <p className="text-sm text-neutral-500">Personaliza el contenido de esta sección</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Título</label>
                <input
                  type="text"
                  value={editingSection.title || ''}
                  onChange={e => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Subtítulo</label>
                <textarea
                  value={editingSection.subtitle || ''}
                  onChange={e => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              {/* Section-specific fields */}
              {editingSection.section_type === 'hero' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Badge (etiqueta superior)</label>
                    <input
                      type="text"
                      value={editingSection.content?.badge || ''}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, badge: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      placeholder="Ej: Exclusively Limited"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Botón Principal - Texto</label>
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
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Botón Principal - URL</label>
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
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingSection.section_type === 'brands_bar' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Marcas (separadas por coma)</label>
                  <input
                    type="text"
                    value={(editingSection.content?.brands || []).join(', ')}
                    onChange={e => setEditingSection({
                      ...editingSection,
                      content: { ...editingSection.content, brands: e.target.value.split(',').map((b: string) => b.trim()) }
                    })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                    placeholder="Travis Scott, Jordan, Nike, Adidas"
                  />
                </div>
              )}

              {editingSection.section_type === 'banner' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">URL del enlace</label>
                    <input
                      type="text"
                      value={editingSection.content?.link_url || ''}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, link_url: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      placeholder="/productos"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Color de fondo</label>
                    <select
                      value={editingSection.settings?.bg_color || 'brand-red'}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        settings: { ...editingSection.settings, bg_color: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                    >
                      <option value="brand-red">Rojo</option>
                      <option value="brand-black">Negro</option>
                      <option value="brand-dark">Oscuro</option>
                      <option value="white">Blanco</option>
                    </select>
                  </div>
                </>
              )}

              {/* Product Picker for product sections */}
              {(editingSection.section_type === 'featured_products' || editingSection.section_type === 'custom_products') && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-neutral-700">
                      Productos seleccionados ({selectedProducts.length})
                    </label>
                    <button
                      onClick={() => setShowProductPicker(!showProductPicker)}
                      className="text-sm text-brand-red hover:text-brand-orange font-medium"
                    >
                      {showProductPicker ? 'Cerrar selector' : '+ Añadir productos'}
                    </button>
                  </div>

                  {/* Selected products tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedProducts.map(pid => {
                      const prod = products.find(p => p.id === pid);
                      if (!prod) return null;
                      return (
                        <span key={pid} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-red/10 text-brand-red rounded-lg text-sm">
                          {prod.brand} - {prod.name.substring(0, 25)}
                          <button onClick={() => toggleProductSelection(pid)} className="hover:text-red-700">×</button>
                        </span>
                      );
                    })}
                  </div>

                  {/* Product picker dropdown */}
                  {showProductPicker && (
                    <div className="border border-neutral-200 rounded-lg max-h-60 overflow-y-auto">
                      <div className="sticky top-0 bg-white p-2 border-b">
                        <input
                          type="text"
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder="Buscar producto..."
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        />
                      </div>
                      <div className="divide-y divide-neutral-100">
                        {filteredProducts.map(product => (
                          <label
                            key={product.id}
                            className={`flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer ${
                              selectedProducts.includes(product.id) ? 'bg-brand-red/5' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => toggleProductSelection(product.id)}
                              className="rounded text-brand-red focus:ring-brand-red"
                            />
                            {product.images?.[0] && (
                              <img src={product.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-brand-black">{product.brand} - {product.name}</p>
                              <p className="text-xs text-neutral-500">€{(product.price / 100).toFixed(2)} · Stock: {product.stock}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Max products setting */}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Máximo de productos a mostrar</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={editingSection.content?.max_products || 6}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, max_products: parseInt(e.target.value) || 6 }
                      })}
                      className="w-20 px-3 py-1 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                    />
                  </div>
                </div>
              )}

              {/* Layout settings */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Columnas (desktop)</label>
                <select
                  value={editingSection.settings?.columns || 3}
                  onChange={e => setEditingSection({
                    ...editingSection,
                    settings: { ...editingSection.settings, columns: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                >
                  <option value={2}>2 columnas</option>
                  <option value={3}>3 columnas</option>
                  <option value={4}>4 columnas</option>
                  <option value={6}>6 columnas</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 flex gap-3 justify-end">
              <button
                onClick={() => setEditingSection(null)}
                className="px-4 py-2 text-neutral-500 hover:text-neutral-700 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveSection}
                disabled={saving}
                className="px-6 py-2 bg-brand-red text-white text-sm font-semibold rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
