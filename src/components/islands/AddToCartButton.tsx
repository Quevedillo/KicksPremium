import React, { useEffect, useState } from 'react';
import { addToCart, openCart, cartStore, getCartQuantityForSize } from '@stores/cart';
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
  const [cartVersion, setCartVersion] = useState(0); // para forzar re-render al cambiar carrito

  // Suscribirse a cambios del carrito para actualizar cantidades disponibles
  useEffect(() => {
    const unsubscribe = cartStore.subscribe(() => {
      setCartVersion(v => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Usar solo tallas del producto con stock disponible (qty > 0)
  const sizes = product.sizes_available && Object.keys(product.sizes_available).length > 0
    ? Object.entries(product.sizes_available)
        .filter(([_, qty]) => (parseInt(qty) || 0) > 0)
        .map(([size]) => size)
        .sort((a, b) => parseFloat(a) - parseFloat(b))
    : [];

  // Si no hay tallas disponibles
  const hasAvailableSizes = sizes.length > 0;

  // Obtener stock disponible para la talla seleccionada (descontando lo que ya está en el carrito)
  const getMaxQuantityForSize = (size: string): number => {
    if (product.sizes_available && product.sizes_available[size]) {
      const totalStock = parseInt(product.sizes_available[size]) || 0;
      const inCart = getCartQuantityForSize(product.id, size);
      return Math.max(0, totalStock - inCart);
    }
    return 0;
  };

  // Cantidad en carrito para la talla seleccionada
  const inCartForSelectedSize = selectedSize ? getCartQuantityForSize(product.id, selectedSize) : 0;

  // Stock máximo restante para la talla actual
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

    // Validar que no se intente comprar más de lo disponible en esa talla (restando lo ya en carrito)
    const maxAvailable = getMaxQuantityForSize(selectedSize);
    if (maxAvailable <= 0) {
      setFeedback(`Ya tienes todos los pares disponibles de talla ${selectedSize} en tu carrito`);
      return;
    }
    
    const actualQty = Math.min(quantity, maxAvailable);

    addToCart(product, actualQty, selectedSize);
    openCart();
    setFeedback(`✓ ${actualQty} par${actualQty > 1 ? 'es' : ''} añadido${actualQty > 1 ? 's' : ''} al carrito`);
    setQuantity(1);
    // NO resetear selectedSize para que el usuario vea qué talla seleccionó

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
          <p className="text-red-800 font-bold text-center">Producto Agotado</p>
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
            const totalStock = getSizeAvailability(size);
            const inCart = getCartQuantityForSize(product.id, size);
            const remaining = Math.max(0, totalStock - inCart);
            const isSoldOutInCart = remaining <= 0;
            return (
              <button
                key={size}
                onClick={() => {
                  if (!isSoldOutInCart) {
                    setSelectedSize(size);
                    setQuantity(1);
                  }
                }}
                disabled={isSoldOutInCart}
                className={`py-3 px-2 text-sm font-bold transition-all flex flex-col items-center justify-center ${
                  isSoldOutInCart
                    ? 'bg-brand-gray/50 text-neutral-600 cursor-not-allowed'
                    : selectedSize === size
                    ? 'bg-brand-red text-white ring-2 ring-brand-orange'
                    : 'bg-brand-gray text-white hover:bg-brand-red/20 hover:text-brand-red cursor-pointer'
                }`}
                title={isSoldOutInCart
                  ? `Talla ${size} - Todo el stock está en tu carrito`
                  : `${remaining} par${remaining !== 1 ? 'es' : ''} disponible${remaining !== 1 ? 's' : ''}${inCart > 0 ? ` (${inCart} en carrito)` : ''}`}
              >
                <span>{size}</span>
                <span className="text-xs opacity-75">
                  {inCart > 0 ? `(${remaining}/${totalStock})` : `(${totalStock})`}
                </span>
              </button>
            );
          })}
        </div>
        {selectedSize && inCartForSelectedSize > 0 && (
          <p className="mt-2 text-xs text-brand-orange">
            Ya tienes {inCartForSelectedSize} par{inCartForSelectedSize > 1 ? 'es' : ''} de talla {selectedSize} en tu carrito
          </p>
        )}
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
        disabled={!hasAvailableSizes || !selectedSize || maxQuantityForSelectedSize <= 0}
        className={`w-full py-4 px-6 font-bold uppercase text-lg tracking-wider transition-all ${
          hasAvailableSizes && selectedSize && maxQuantityForSelectedSize > 0
            ? 'bg-brand-red text-white hover:bg-brand-orange cursor-pointer hover:scale-[1.02]'
            : 'bg-brand-gray text-neutral-500 cursor-not-allowed'
        }`}
      >
        {!hasAvailableSizes 
          ? 'Agotado' 
          : !selectedSize 
          ? 'Selecciona una talla' 
          : maxQuantityForSelectedSize <= 0
          ? 'Stock completo en carrito'
          : 'Añadir al Carrito'}
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
