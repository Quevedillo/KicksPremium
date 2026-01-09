import React, { useEffect, useState } from 'react';
import { cartStore, removeFromCart, updateCartItemQuantity, closeCart, getCartTotal } from '@stores/cart';

export default function CartSlideOver() {
  const [cart, setCart] = useState(cartStore.get());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Subscribe to cart changes
    const unsubscribe = cartStore.subscribe((newCart) => {
      setCart(newCart);
    });
    
    return () => unsubscribe();
  }, []);

  const total = getCartTotal();

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart.items,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar el pago');
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {cart.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-40"
          onClick={() => closeCart()}
        />
      )}

      {/* Slide Over Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-brand-dark shadow-2xl z-50 transform transition-transform duration-300 ${
          cart.isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-brand-gray bg-brand-black">
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">
              🛒 Tu Carrito
            </h2>
            <button
              onClick={() => closeCart()}
              className="text-neutral-400 hover:text-white transition-colors"
              aria-label="Cerrar carrito"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Items */}
          {cart.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-6xl mb-4">👟</div>
              <p className="text-neutral-500 text-center text-lg">
                Tu carrito está vacío
              </p>
              <a 
                href="/productos"
                onClick={() => closeCart()}
                className="mt-6 bg-brand-red text-white px-6 py-3 font-bold uppercase hover:bg-brand-orange transition-colors"
              >
                Explorar Kicks
              </a>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.items.map((item) => (
                <div key={`${item.product_id}-${item.size}`} className="flex gap-4 bg-brand-gray p-4">
                  {/* Product Image */}
                  <div className="w-24 h-24 bg-brand-black flex-shrink-0 overflow-hidden">
                    {item.product.images[0] && (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-brand-red text-xs font-bold uppercase">
                        {item.product.brand}
                      </p>
                      <h3 className="font-bold text-white text-sm line-clamp-2">
                        {item.product.name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        Talla: <span className="text-white">{item.size}</span>
                      </p>
                      <p className="text-lg font-bold text-brand-red mt-1">
                        {formatPrice(item.product.price)}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() =>
                          updateCartItemQuantity(
                            item.product_id,
                            item.size,
                            item.quantity - 1
                          )
                        }
                        className="w-8 h-8 bg-brand-black text-white text-sm font-bold hover:bg-brand-red transition-colors"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold text-white w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateCartItemQuantity(
                            item.product_id,
                            item.size,
                            item.quantity + 1
                          )
                        }
                        className="w-8 h-8 bg-brand-black text-white text-sm font-bold hover:bg-brand-red transition-colors"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product_id, item.size)}
                        className="ml-auto text-xs text-neutral-500 hover:text-brand-red transition-colors"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer with Total and Checkout */}
          {cart.items.length > 0 && (
            <div className="border-t border-brand-gray p-6 space-y-4 bg-brand-black">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 uppercase text-sm">Total:</span>
                <span className="text-2xl font-bold text-white">{formatPrice(total)}</span>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 text-sm">
                  ⚠️ {error}
                </div>
              )}

              <button 
                onClick={handleCheckout}
                disabled={isProcessing}
                className={`w-full py-4 font-bold uppercase tracking-wider transition-all ${
                  isProcessing 
                    ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed' 
                    : 'bg-brand-red text-white hover:bg-brand-orange hover:scale-[1.02]'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Procesando...
                  </span>
                ) : (
                  '🔒 Pagar con Stripe'
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-neutral-500 text-xs">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
                <span>Pago seguro con encriptación SSL</span>
              </div>

              <button
                onClick={() => closeCart()}
                className="w-full bg-brand-gray text-white py-3 font-bold uppercase tracking-wider hover:bg-brand-dark transition-colors"
              >
                Continuar Comprando
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
