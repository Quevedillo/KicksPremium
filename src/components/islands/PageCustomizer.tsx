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

  // Mini preview component for each section type
  const SectionPreview = ({ section }: { section: PageSection }) => {
    const previewStyles: Record<string, { bg: string; preview: React.ReactNode }> = {
      hero: {
        bg: 'bg-gradient-to-br from-neutral-900 to-neutral-800',
        preview: (
          <div className="p-3 text-white">
            <div className="w-12 h-1.5 bg-red-500 rounded mb-1.5"></div>
            <div className="w-20 h-2 bg-white/80 rounded mb-1"></div>
            <div className="w-16 h-2 bg-red-500 rounded mb-1"></div>
            <div className="w-14 h-2 bg-white/60 rounded mb-2"></div>
            <div className="flex gap-1">
              <div className="w-10 h-3 bg-red-500 rounded-sm"></div>
              <div className="w-10 h-3 border border-white/40 rounded-sm"></div>
            </div>
          </div>
        )
      },
      brands_bar: {
        bg: 'bg-neutral-800',
        preview: (
          <div className="p-3 flex items-center justify-center gap-3">
            {['Nike', 'Jordan', 'Travis'].map(b => (
              <span key={b} className="text-[7px] text-neutral-400 font-bold uppercase tracking-wider">{b}</span>
            ))}
          </div>
        )
      },
      categories: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-2 grid grid-cols-4 gap-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="aspect-square bg-neutral-700 rounded-sm relative overflow-hidden">
                <div className="absolute bottom-0.5 left-0.5 w-5 h-1 bg-white/60 rounded-sm"></div>
              </div>
            ))}
          </div>
        )
      },
      featured_products: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-2">
            <div className="w-10 h-1 bg-red-500/60 rounded mb-1 mx-auto"></div>
            <div className="grid grid-cols-3 gap-1">
              {[1,2,3].map(i => (
                <div key={i} className="bg-neutral-800 rounded-sm p-1">
                  <div className="aspect-square bg-neutral-700 rounded-sm mb-0.5"></div>
                  <div className="w-full h-0.5 bg-neutral-600 rounded"></div>
                  <div className="w-6 h-0.5 bg-white/40 rounded mt-0.5"></div>
                </div>
              ))}
            </div>
          </div>
        )
      },
      custom_products: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-2">
            <div className="w-12 h-1 bg-white/40 rounded mb-1"></div>
            <div className="grid grid-cols-3 gap-1">
              {[1,2,3].map(i => (
                <div key={i} className="bg-neutral-800 rounded-sm p-1">
                  <div className="aspect-square bg-neutral-700 rounded-sm mb-0.5 flex items-center justify-center">
                    <div className="w-3 h-3 border border-neutral-600 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      },
      banner: {
        bg: 'bg-gradient-to-r from-red-600 to-red-500',
        preview: (
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="w-16 h-1.5 bg-white/80 rounded mb-1"></div>
              <div className="w-12 h-1 bg-white/50 rounded"></div>
            </div>
            <div className="w-8 h-3 bg-white rounded-sm"></div>
          </div>
        )
      },
      newsletter: {
        bg: 'bg-neutral-900',
        preview: (
          <div className="p-3 text-center">
            <div className="w-16 h-1.5 bg-white/60 rounded mb-1 mx-auto"></div>
            <div className="w-10 h-1 bg-red-500/60 rounded mb-2 mx-auto"></div>
            <div className="flex gap-1 justify-center">
              <div className="w-16 h-3 bg-neutral-700 rounded-sm"></div>
              <div className="w-8 h-3 bg-red-500 rounded-sm"></div>
            </div>
          </div>
        )
      }
    };

    const style = previewStyles[section.section_type] || previewStyles.banner;

    return (
      <div className={`${style.bg} rounded-lg overflow-hidden shadow-inner border border-white/5 w-36 h-20 flex-shrink-0`}>
        {style.preview}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <svg className="w-7 h-7 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Diseñador Visual
            </h1>
            <p className="text-neutral-400 text-sm mt-1">Diseña y organiza las secciones de tu tienda en tiempo real</p>
          </div>
          <div className="flex gap-3">
            <a href="/" target="_blank" className="px-4 py-2.5 bg-white/10 text-white text-sm font-medium rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2 backdrop-blur-sm border border-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Vista previa
            </a>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-brand-red text-white text-sm font-semibold rounded-xl hover:bg-brand-orange transition-all hover:scale-105 flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Añadir Sección
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-2xl font-bold">{sections.length}</p>
            <p className="text-xs text-neutral-400">Secciones</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-2xl font-bold text-green-400">{sections.filter(s => s.is_visible).length}</p>
            <p className="text-xs text-neutral-400">Visibles</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-2xl font-bold text-yellow-400">{sections.filter(s => !s.is_visible).length}</p>
            <p className="text-xs text-neutral-400">Ocultas</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-2xl font-bold text-blue-400">{selections.length}</p>
            <p className="text-xs text-neutral-400">Productos asignados</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-slideUp ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{message.type === 'success' ? '✓' : '✕'}</span>
          {message.text}
        </div>
      )}

      {/* Layout visual: Preview + Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left: Miniature Page Preview */}
        <div className="xl:col-span-1">
          <div className="sticky top-24 bg-neutral-900 rounded-2xl p-4 border border-neutral-700 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-700">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 bg-neutral-800 rounded-md h-4 flex items-center px-2">
                <span className="text-[7px] text-neutral-500">kickspremium.com</span>
              </div>
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Nav preview */}
              <div className="bg-neutral-800 rounded h-4 flex items-center px-2 gap-2">
                <div className="w-6 h-2 bg-red-500 rounded-sm"></div>
                <div className="flex-1"></div>
                <div className="w-3 h-2 bg-neutral-600 rounded-sm"></div>
                <div className="w-3 h-2 bg-neutral-600 rounded-sm"></div>
              </div>
              {sections.filter(s => s.is_visible).map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => openEditor(section)}
                  className="w-full transition-all hover:ring-2 hover:ring-brand-red rounded-lg relative group"
                  title={`Editar: ${section.title || getSectionLabel(section.section_type)}`}
                >
                  <SectionPreview section={section} />
                  <div className="absolute inset-0 bg-brand-red/0 group-hover:bg-brand-red/10 rounded-lg transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold bg-brand-red px-2 py-0.5 rounded shadow">
                      Editar
                    </span>
                  </div>
                  <div className="absolute -right-1 -top-1 bg-neutral-700 text-neutral-300 text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                    {idx + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Section Manager */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-brand-black flex items-center gap-2">
              <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Orden de Secciones
            </h2>
            <span className="text-xs text-neutral-400">Arrastra para reordenar</span>
          </div>

          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={`group bg-white border-2 rounded-2xl transition-all duration-200 ${
                section.is_visible 
                  ? 'border-neutral-200 hover:border-brand-red/30 hover:shadow-lg hover:shadow-red-500/5' 
                  : 'border-dashed border-neutral-300 bg-neutral-50/50 opacity-70'
              }`}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Order & Move Controls */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => moveSection(section.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-red hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-xs font-bold text-neutral-300 w-6 h-6 flex items-center justify-center bg-neutral-100 rounded-lg">
                    {idx + 1}
                  </span>
                  <button
                    onClick={() => moveSection(section.id, 'down')}
                    disabled={idx === sections.length - 1}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-red hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Mini Preview */}
                <div className="hidden md:block">
                  <SectionPreview section={section} />
                </div>

                {/* Section Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getSectionIcon(section.section_type)}</span>
                    <h3 className="font-bold text-brand-black text-sm">{section.title || getSectionLabel(section.section_type)}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full font-medium">
                      {getSectionLabel(section.section_type)}
                    </span>
                    {section.is_visible ? (
                      <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Activo
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded-full font-medium">
                        Oculto
                      </span>
                    )}
                  </div>
                  {section.subtitle && (
                    <p className="text-xs text-neutral-400 truncate">{section.subtitle}</p>
                  )}
                  
                  {/* Product thumbnails for product sections */}
                  {(section.section_type === 'featured_products' || section.section_type === 'custom_products') && (
                    <div className="flex items-center gap-1 mt-2">
                      {selections
                        .filter(s => s.section_id === section.id)
                        .sort((a, b) => a.display_order - b.display_order)
                        .slice(0, 5)
                        .map(sel => (
                          <div key={sel.id} className="w-8 h-8 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 shadow-sm">
                            {sel.products?.images?.[0] ? (
                              <img src={sel.products.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-400">?</div>
                            )}
                          </div>
                        ))
                      }
                      {selections.filter(s => s.section_id === section.id).length > 5 && (
                        <span className="text-[10px] text-neutral-400 ml-1">
                          +{selections.filter(s => s.section_id === section.id).length - 5} más
                        </span>
                      )}
                      {selections.filter(s => s.section_id === section.id).length === 0 && (
                        <span className="text-[10px] text-neutral-400 italic">Auto-selección</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleVisibility(section)}
                    className={`p-2.5 rounded-xl transition-all ${
                      section.is_visible 
                        ? 'text-green-600 hover:bg-green-50 hover:shadow-sm' 
                        : 'text-neutral-400 hover:bg-neutral-100'
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
                    className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all hover:shadow-sm"
                    title="Editar sección"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all hover:shadow-sm"
                    title="Eliminar sección"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="text-center py-20 bg-gradient-to-br from-neutral-50 to-white rounded-2xl border-2 border-dashed border-neutral-200">
              <div className="text-6xl mb-4">🎨</div>
              <p className="text-neutral-500 mb-2 font-semibold">Tu página está vacía</p>
              <p className="text-neutral-400 text-sm mb-6">Empieza añadiendo secciones para diseñar tu tienda</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-brand-red text-white text-sm font-bold rounded-xl hover:bg-brand-orange transition-all hover:scale-105 shadow-lg shadow-red-500/20"
              >
                + Añadir primera sección
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Section Modal - Visual Card Grid */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200 bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Añadir Nueva Sección
              </h2>
              <p className="text-sm text-neutral-400 mt-1">Elige el tipo de bloque para tu página</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {SECTION_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => addSection(type.value)}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl hover:bg-neutral-50 transition-all text-center border-2 border-neutral-100 hover:border-brand-red/30 hover:shadow-lg hover:shadow-red-500/5 group"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">{type.icon}</span>
                  <div>
                    <p className="font-bold text-brand-black text-sm">{type.label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-neutral-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full py-2.5 text-neutral-500 hover:text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingSection(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200 bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getSectionIcon(editingSection.section_type)}</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Editar: {getSectionLabel(editingSection.section_type)}</h2>
                  <p className="text-sm text-neutral-400">Personaliza el contenido de esta sección</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Título</label>
                <input
                  type="text"
                  value={editingSection.title || ''}
                  onChange={e => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Subtítulo</label>
                <textarea
                  value={editingSection.subtitle || ''}
                  onChange={e => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                />
              </div>

              {/* Section-specific fields */}
              {editingSection.section_type === 'hero' && (
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-5 space-y-4 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">🎯 Configuración del Hero</h3>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Badge (etiqueta superior)</label>
                    <input
                      type="text"
                      value={editingSection.content?.badge || ''}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, badge: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                      placeholder="Ej: Exclusively Limited"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Botón Principal - Texto</label>
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
                        className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Botón Principal - URL</label>
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
                        className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {editingSection.section_type === 'brands_bar' && (
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-5 space-y-3 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">🏷️ Configuración de Marcas</h3>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Marcas (separadas por coma)</label>
                    <input
                      type="text"
                      value={(editingSection.content?.brands || []).join(', ')}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, brands: e.target.value.split(',').map((b: string) => b.trim()) }
                      })}
                      className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                      placeholder="Travis Scott, Jordan, Nike, Adidas"
                    />
                  </div>
                </div>
              )}

              {editingSection.section_type === 'banner' && (
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-5 space-y-4 border border-neutral-200">
                  <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">📢 Configuración del Banner</h3>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">URL del enlace</label>
                    <input
                      type="text"
                      value={editingSection.content?.link_url || ''}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, link_url: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red text-neutral-900 transition-all"
                      placeholder="/productos"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Color de fondo</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'brand-red', label: 'Rojo', color: 'bg-red-600' },
                        { value: 'brand-black', label: 'Negro', color: 'bg-neutral-900' },
                        { value: 'brand-dark', label: 'Oscuro', color: 'bg-neutral-700' },
                        { value: 'white', label: 'Blanco', color: 'bg-white border-2 border-neutral-300' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditingSection({
                            ...editingSection,
                            settings: { ...editingSection.settings, bg_color: opt.value }
                          })}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                            (editingSection.settings?.bg_color || 'brand-red') === opt.value
                              ? 'border-brand-red ring-2 ring-brand-red/20 bg-white'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full ${opt.color}`}></div>
                          <span className="text-xs font-medium text-neutral-600">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Product Picker for product sections */}
              {(editingSection.section_type === 'featured_products' || editingSection.section_type === 'custom_products') && (
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-5 space-y-4 border border-neutral-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                      👟 Productos seleccionados
                      <span className="px-2 py-0.5 bg-brand-red text-white text-xs rounded-full">{selectedProducts.length}</span>
                    </h3>
                    <button
                      onClick={() => setShowProductPicker(!showProductPicker)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-orange transition-colors"
                    >
                      {showProductPicker ? '✕ Cerrar' : '+ Añadir'}
                    </button>
                  </div>

                  {/* Selected products as image grid */}
                  {selectedProducts.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {selectedProducts.map(pid => {
                        const prod = products.find(p => p.id === pid);
                        if (!prod) return null;
                        return (
                          <div key={pid} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden border-2 border-neutral-200 bg-white">
                              {prod.images?.[0] ? (
                                <img src={prod.images[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">👟</div>
                              )}
                            </div>
                            <button
                              onClick={() => toggleProductSelection(pid)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >×</button>
                            <p className="text-[10px] text-neutral-500 mt-1 truncate text-center">{prod.name.substring(0, 15)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Product picker dropdown */}
                  {showProductPicker && (
                    <div className="border-2 border-neutral-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-white">
                      <div className="sticky top-0 bg-white p-3 border-b border-neutral-200">
                        <input
                          type="text"
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder="🔍 Buscar producto..."
                          className="w-full px-3 py-2 border-2 border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                        />
                      </div>
                      <div className="divide-y divide-neutral-100">
                        {filteredProducts.map(product => (
                          <label
                            key={product.id}
                            className={`flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer transition-colors ${
                              selectedProducts.includes(product.id) ? 'bg-brand-red/5 border-l-4 border-l-brand-red' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => toggleProductSelection(product.id)}
                              className="rounded text-brand-red focus:ring-brand-red"
                            />
                            {product.images?.[0] && (
                              <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-neutral-200" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 truncate">{product.brand} - {product.name}</p>
                              <p className="text-xs text-neutral-500">€{(product.price / 100).toFixed(2)} · Stock: {product.stock}</p>
                            </div>
                            {selectedProducts.includes(product.id) && (
                              <span className="text-brand-red text-lg">✓</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Max products setting */}
                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-sm font-medium text-neutral-600">Máx. productos:</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={editingSection.content?.max_products || 6}
                      onChange={e => setEditingSection({
                        ...editingSection,
                        content: { ...editingSection.content, max_products: parseInt(e.target.value) || 6 }
                      })}
                      className="w-20 px-3 py-2 border-2 border-neutral-200 rounded-xl text-sm text-neutral-900 font-semibold text-center focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Layout settings */}
              <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-5 border border-neutral-200">
                <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2 mb-3">⚙️ Diseño</h3>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Columnas (desktop)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 6].map(cols => (
                    <button
                      key={cols}
                      type="button"
                      onClick={() => setEditingSection({
                        ...editingSection,
                        settings: { ...editingSection.settings, columns: cols }
                      })}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        (editingSection.settings?.columns || 3) === cols
                          ? 'border-brand-red ring-2 ring-brand-red/20 bg-white'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
                          <div key={i} className={`h-6 rounded-sm ${(editingSection.settings?.columns || 3) === cols ? 'bg-brand-red' : 'bg-neutral-300'}`} style={{ width: `${24 / cols}px` }}></div>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-neutral-600">{cols} col</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 flex gap-3 justify-end bg-neutral-50 rounded-b-2xl">
              <button
                onClick={() => setEditingSection(null)}
                className="px-5 py-2.5 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-200 text-sm font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveSection}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-red to-red-600 text-white text-sm font-bold rounded-xl hover:from-brand-orange hover:to-orange-500 transition-all disabled:opacity-50 shadow-lg shadow-red-500/25"
              >
                {saving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
