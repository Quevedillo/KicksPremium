import React, { useState } from 'react';

interface SizePickerProps {
  sizesAvailable: Record<string, number>;
  selectedSize?: string;
  onSizeSelect?: (size: string) => void;
}

export const SizePicker: React.FC<SizePickerProps> = ({
  sizesAvailable,
  selectedSize,
  onSizeSelect,
}) => {
  const [selected, setSelected] = useState<string | undefined>(selectedSize);

  // Solo mostrar tallas con stock > 0
  const allSizes = Object.entries(sizesAvailable)
    .filter(([_, qty]) => (typeof qty === 'number' ? qty : parseInt(String(qty)) || 0) > 0)
    .map(([size]) => size)
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  const handleSelect = (size: string) => {
    const qtyValue = sizesAvailable[size];
    const qty = typeof qtyValue === 'number' ? qtyValue : parseInt(String(qtyValue)) || 0;
    if (qty > 0) {
      setSelected(size);
      onSizeSelect?.(size);
    }
  };

  // Si no hay tallas disponibles
  if (allSizes.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
        <p className="text-sm text-red-900 font-semibold">Producto Agotado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Selecciona tu talla</h3>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
          {allSizes.map((size) => {
            const available = sizesAvailable[size] > 0;
            const isSelected = selected === size;

            return (
              <button
                key={size}
                onClick={() => handleSelect(size)}
                disabled={!available}
                className={`
                  py-3 px-2 rounded border-2 font-semibold text-sm transition-all
                  ${isSelected
                    ? 'border-brand-black bg-brand-black text-white'
                    : available
                    ? 'border-neutral-300 bg-white text-neutral-900 hover:border-brand-black hover:bg-neutral-50 cursor-pointer'
                    : 'border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  }
                `}
              >
                <span className="block">{size}</span>
                {!available && (
                  <span className="block text-xs text-neutral-400 mt-1">Agotado</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-900">
            <strong>Talla {selected}</strong> - {sizesAvailable[selected]} {sizesAvailable[selected] === 1 ? 'par' : 'pares'} disponibles
          </p>
        </div>
      )}
    </div>
  );
};
