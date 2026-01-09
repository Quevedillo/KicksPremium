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

  // Tallas numéricas para zapatos (EU)
  const sizes = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

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
    // Check authentication first
    if (!user) {
      setFeedback('');
      window.location.href = '/auth/login?redirect=/productos/' + product.slug;
      return;
    }

    if (!selectedSize) {
      setFeedback('Por favor, selecciona una talla');
      return;
    }

    if (product.stock <= 0) {
      setFeedback('Producto agotado');
      return;
    }

    addToCart(product, quantity, selectedSize);
    openCart();
    setFeedback('✓ Agregado al carrito');
    setQuantity(1);
    setSelectedSize('');

    setTimeout(() => setFeedback(''), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {isLoading && (
        <div className="p-4 bg-brand-gray text-neutral-400 text-sm text-center">
          Cargando...
        </div>
      )}

      {/* Authentication Warning */}
      {!isLoading && !user && (
        <div className="p-4 bg-brand-gray border border-brand-red/30 text-neutral-300 text-sm">
          ⚡ Necesitas iniciar sesión para agregar al carrito. <a href="/auth/login" className="font-bold text-brand-red hover:text-brand-orange underline">Hacerlo ahora</a>
        </div>
      )}

      {/* Size Selection */}
      <div>
        <label className="block text-sm font-bold text-white uppercase tracking-wider mb-3">
          Selecciona tu talla (EU)
        </label>
        <div className="grid grid-cols-6 gap-2">
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`py-3 px-2 text-sm font-bold transition-all ${
                selectedSize === size
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-gray text-white hover:bg-brand-red/20 hover:text-brand-red'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              disabled={product.stock <= 0 || !user}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-sm font-bold text-white uppercase tracking-wider mb-3">
          Cantidad
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-12 h-12 bg-brand-gray text-white font-bold hover:bg-brand-red transition-colors"
            disabled={!user}
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max={product.stock}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))
            }
            className="w-20 h-12 text-center bg-brand-gray text-white font-bold border-0 focus:ring-2 focus:ring-brand-red"
            disabled={!user}
          />
          <button
            onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
            className="w-12 h-12 bg-brand-gray text-white font-bold hover:bg-brand-red transition-colors"
            disabled={!user}
          >
            +
          </button>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={product.stock <= 0}
        className={`w-full py-4 px-6 font-bold uppercase text-lg tracking-wider transition-all ${
          product.stock > 0
            ? 'bg-brand-red text-white hover:bg-brand-orange cursor-pointer hover:scale-[1.02]'
            : 'bg-brand-gray text-neutral-500 cursor-not-allowed'
        }`}
      >
        {product.stock > 0 ? '🛒 Añadir al Carrito' : 'Agotado'}
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
