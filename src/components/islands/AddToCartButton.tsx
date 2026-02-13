import React, { useEffect, useState } from 'react';
import { addToCart, openCart } from '@stores/cart';
import { authStore, getCurrentUser, initializeAuth } from '@stores/auth';
import type { Product } from '@lib/supabase';

interface AddToCartButtonProps {
  product: Product;
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [feedback, setFeedback] = useState<string>('');
  const [user, setUser] = useState(getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);

  // Usar solo tallas del producto con stock disponible (qty > 0)
  const sizes = product.sizes_available && Object.keys(product.sizes_available).length > 0
    ? Object.entries(product.sizes_available)
        .filter(([_, qty]) => (parseInt(qty) || 0) > 0)
        .map(([size]) => size)
        .sort((a, b) => parseFloat(a) - parseFloat(b))
    : [];

  // Si no hay tallas disponibles
  const hasAvailableSizes = sizes.length > 0;

  // Obtener stock disponible para la talla seleccionada
  const getMaxQuantityForSize = (size: string): number => {
    if (product.sizes_available && product.sizes_available[size]) {
      return parseInt(product.sizes_available[size]) || 0;
    }
    return 0;
  };

  // Stock máximo para la talla actual
  const maxQuantityForSelectedSize = selectedSize ? getMaxQuantityForSize(selectedSize) : 0;

  useEffect(() => {
    // Inicializar auth al montar el componente
    initializeAuth().then(() => {
      setUser(getCurrentUser());
      setIsLoading(false);
    });

    const unsubscribe = authStore.subscribe((state) => {
      setUser(state.user);
      setIsLoading(state.isLoading);
    });

    return () => unsubscribe();
  }, []);

  const handleAddToCart = () => {
    if (!selectedSize) {
      setFeedback('Por favor, selecciona una talla');
      return;
    }

    if (product.stock <= 0) {
      setFeedback('Producto agotado');
      return;
    }

    // Validar que no se intente comprar más de lo disponible en esa talla
    const maxAvailable = getMaxQuantityForSize(selectedSize);
    if (quantity > maxAvailable) {
      setFeedback(`Solo hay ${maxAvailable} pares disponibles en talla ${selectedSize}`);
      return;
    }

    addToCart(product, quantity, selectedSize);
    openCart();
    setFeedback('✓ Agregado al carrito');
    setQuantity(1);
    setSelectedSize('');

    setTimeout(() => setFeedback(''), 2000);
  };

  const getSizeAvailability = (size: string): number => {
    if (product.sizes_available && product.sizes_available[size]) {
      return parseInt(product.sizes_available[size]) || 0;
    }
    return 0;
  };

  // If no sizes available, show out of stock
  if (!hasAvailableSizes) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-800 font-bold text-center">❌ Producto Agotado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {isLoading && (
        <div className="p-4 bg-brand-gray text-neutral-400 text-sm text-center">
          Cargando...
        </div>
      )}



      {/* Size Selection */}
      <div>
        <label className="block text-sm font-bold text-white uppercase tracking-wider mb-3">
          Selecciona tu talla (EU) - {sizes.length} disponible{sizes.length !== 1 ? 's' : ''}
        </label>
        <div className="grid grid-cols-6 gap-2">
          {sizes.map((size) => {
            const quantity = getSizeAvailability(size);
            return (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`py-3 px-2 text-sm font-bold transition-all flex flex-col items-center justify-center ${
                  selectedSize === size
                    ? 'bg-brand-red text-white ring-2 ring-brand-orange'
                    : 'bg-brand-gray text-white hover:bg-brand-red/20 hover:text-brand-red cursor-pointer'
                }`}
                title={`${quantity} par${quantity !== 1 ? 'es' : ''} disponible${quantity !== 1 ? 's' : ''}`}
              >
                <span>{size}</span>
                <span className="text-xs opacity-75">({quantity})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-sm font-bold text-white uppercase tracking-wider mb-3">
          Cantidad (Máximo: {maxQuantityForSelectedSize} par{maxQuantityForSelectedSize !== 1 ? 'es' : ''})
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-12 h-12 bg-brand-gray text-white font-bold hover:bg-brand-red transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max={maxQuantityForSelectedSize}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(maxQuantityForSelectedSize, parseInt(e.target.value) || 1)))
            }
            className="w-20 h-12 text-center bg-brand-gray text-white font-bold border-0 focus:ring-2 focus:ring-brand-red"
            disabled={!selectedSize}
          />
          <button
            onClick={() => setQuantity(Math.min(maxQuantityForSelectedSize, quantity + 1))}
            className="w-12 h-12 bg-brand-gray text-white font-bold hover:bg-brand-red transition-colors"
            disabled={quantity >= maxQuantityForSelectedSize}
          >
            +
          </button>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={!hasAvailableSizes || !selectedSize}
        className={`w-full py-4 px-6 font-bold uppercase text-lg tracking-wider transition-all ${
          hasAvailableSizes && selectedSize
            ? 'bg-brand-red text-white hover:bg-brand-orange cursor-pointer hover:scale-[1.02]'
            : 'bg-brand-gray text-neutral-500 cursor-not-allowed'
        }`}
      >
        {!hasAvailableSizes ? 'Agotado' : !selectedSize ? 'Selecciona una talla' : 'Añadir al Carrito'}
      </button>

      {/* Feedback Message */}
      {feedback && (
        <p className={`text-center font-bold ${feedback.startsWith('✓') ? 'text-green-500' : 'text-brand-red'}`}>
          {feedback}
        </p>
      )}
    </div>
  );
}
