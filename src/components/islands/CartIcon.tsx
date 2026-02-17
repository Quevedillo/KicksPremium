import React, { useEffect, useState } from 'react';
import { cartStore, toggleCart, getCartItemCount } from '@stores/cart';

export default function CartIcon() {
  const [cart, setCart] = useState(cartStore.get());
  
  useEffect(() => {
    const unsubscribe = cartStore.subscribe((newCart) => {
      setCart(newCart);
    });
    
    return () => unsubscribe();
  }, []);
  
  const itemCount = getCartItemCount();

  return (
    <button
      onClick={() => toggleCart()}
      className="relative inline-flex items-center justify-center w-10 h-10 text-white hover:text-neutral-300 transition-colors"
      aria-label="Abrir carrito"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
      {itemCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
          {itemCount}
        </span>
      )}
    </button>
  );
}
