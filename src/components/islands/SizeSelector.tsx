import React, { useState, useEffect } from 'react';

interface SizeSelectorProps {
  initialSizes?: Record<string, number>;
  onSizesChange?: (sizes: Record<string, number>, totalStock: number) => void;
}

const AVAILABLE_SIZES = [
  '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42',
  '42.5', '43', '43.5', '44', '44.5', '45', '45.5', '46', '47', '48', '49', '50', '51', '52'
];

export const SizeSelector: React.FC<SizeSelectorProps> = ({ initialSizes, onSizesChange }) => {
  const [sizes, setSizes] = useState<Record<string, number>>(initialSizes || {});
  
  // Calcular stock total siempre desde las tallas
  const totalStock = Object.values(sizes).reduce((sum, qty) => sum + (qty || 0), 0);

  // Emitir cambios
  const emitChanges = (newSizes: Record<string, number>) => {
    const newTotal = Object.values(newSizes).reduce((sum, qty) => sum + (qty || 0), 0);
    
    // Emitir evento global para otros componentes
    const event = new CustomEvent('sizes-updated', {
      detail: { sizes: newSizes, totalStock: newTotal }
    });
    window.dispatchEvent(event);
    
    // Actualizar campo de stock oculto
    const stockInput = document.getElementById('stock') as HTMLInputElement;
    if (stockInput) {
      stockInput.value = newTotal.toString();
      // Disparar evento change para que el form lo detecte
      stockInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    onSizesChange?.(newSizes, newTotal);
  };

  // Actualizar cantidad de una talla
  const updateSize = (size: string, quantity: number) => {
    let newSizes = { ...sizes };
    
    if (quantity <= 0) {
      delete newSizes[size];
    } else {
      newSizes[size] = quantity;
    }

    setSizes(newSizes);
    emitChanges(newSizes);
  };

  // Añadir una nueva talla con cantidad 1
  const addSize = (size: string) => {
    if (!sizes.hasOwnProperty(size)) {
      const newSizes = { ...sizes, [size]: 1 };
      setSizes(newSizes);
      emitChanges(newSizes);
    }
  };

  // Eliminar una talla
  const removeSize = (size: string) => {
    const newSizes = { ...sizes };
    delete newSizes[size];
    setSizes(newSizes);
    emitChanges(newSizes);
  };

  // Limpiar todas las tallas
  const clearAll = () => {
    setSizes({});
    emitChanges({});
  };

  // Al cargar, emitir el estado inicial
  useEffect(() => {
    if (initialSizes && Object.keys(initialSizes).length > 0) {
      setSizes(initialSizes);
      emitChanges(initialSizes);
    }
  }, []);

  // Ordenar tallas seleccionadas
  const sortedSizes = Object.entries(sizes)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

  return (
    <div className="space-y-6">
      {/* Stock info calculado automáticamente */}
      <div className={`border rounded-lg p-4 ${totalStock > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <p className={`text-sm font-medium ${totalStock > 0 ? 'text-green-900' : 'text-red-900'}`}>
          📦 Stock Total: <strong>{totalStock}</strong> pares
          {totalStock === 0 && ' — Este producto NO será visible en la tienda'}
        </p>
      </div>

      {/* Tallas seleccionadas */}
      {sortedSizes.length > 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-neutral-900">Tallas con Stock</h3>
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors"
            >
              Limpiar Todo
            </button>
          </div>
          <div className="space-y-3">
            {sortedSizes.map(([size, quantity]) => (
              <div key={size} className="flex items-center justify-between gap-3 p-3 bg-neutral-50 rounded border border-neutral-200">
                <div className="flex-1">
                  <p className="font-medium text-neutral-900">Talla {size}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateSize(size, quantity - 1)}
                    className="px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded text-sm text-neutral-900"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => updateSize(size, Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    className="w-16 text-center border border-neutral-300 rounded px-2 py-1 bg-white text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => updateSize(size, quantity + 1)}
                    className="px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded text-sm text-neutral-900"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSize(size)}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm ml-2"
                    title="Eliminar talla"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector de tallas disponibles */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <h3 className="font-semibold text-neutral-900 mb-4">
          {sortedSizes.length === 0 ? 'Selecciona las Tallas Disponibles' : 'Añadir Más Tallas'}
        </h3>
        <p className="text-xs text-neutral-500 mb-3">
          Haz clic en una talla para añadirla. Luego puedes ajustar la cantidad.
        </p>
        <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
          {AVAILABLE_SIZES.map((size) => {
            const isSelected = sizes.hasOwnProperty(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    removeSize(size);
                  } else {
                    addSize(size);
                  }
                }}
                className={`
                  py-2 px-3 rounded border font-medium text-sm transition-all
                  ${isSelected
                    ? 'bg-brand-black text-white border-brand-black'
                    : 'bg-neutral-50 text-neutral-900 border-neutral-300 hover:bg-neutral-100 hover:border-neutral-400 cursor-pointer'
                  }
                `}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden inputs para el formulario */}
      <input
        type="hidden"
        name="sizes_available"
        value={JSON.stringify(sizes)}
      />
    </div>
  );
};
