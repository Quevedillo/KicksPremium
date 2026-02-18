import React, { useEffect, useState } from 'react';
import { 
  cartStore, 
  removeFromCart, 
  updateCartItemQuantity, 
  closeCart, 
  getCartTotal,
  getCartSubtotal,
  getDiscountAmount,
  applyDiscountCode,
  removeDiscountCode,
  type DiscountCode
} from '@stores/cart';
import { supabase } from '@lib/supabase';
import { authStore } from '@stores/auth';

export default function CartSlideOver() {
  const [cart, setCart] = useState(cartStore.get());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [guestPassword, setGuestPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  useEffect(() => {
    // Mark component as mounted to prevent hydration mismatch
    setIsMounted(true);
    
    // Subscribe to cart changes
    const unsubscribe = cartStore.subscribe((newCart) => {
      setCart(newCart);
    });

    // Check auth state on mount - show email field proactively for guests
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsGuest(true);
        }
      } catch {
        setIsGuest(true);
      }
    };
    checkAuth();

    // Escuchar cambios de auth para cerrar carrito al cerrar sesión
    const unsubAuth = authStore.subscribe((state) => {
      if (!state.user) {
        setIsGuest(true);
      } else {
        setIsGuest(false);
      }
    });
    
    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  const subtotal = getCartSubtotal();
  const discountAmount = getDiscountAmount();
  const total = getCartTotal();

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyingDiscount(true);
    setDiscountMessage(null);
    setError(null);

    try {
      if (!discountCode.trim()) {
        setDiscountMessage('Por favor ingresa un código');
        setApplyingDiscount(false);
        return;
      }

      // Obtener usuario si está autenticado
      let userId = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      }

      // Validar código en API
      const response = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discountCode.toUpperCase(),
          cartTotal: subtotal,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setDiscountMessage(`❌ ${data.error || 'Código inválido o expirado'}`);
        removeDiscountCode();
        setApplyingDiscount(false);
        return;
      }

      // Aplicar descuento
      const discount: DiscountCode = {
        code: discountCode.toUpperCase(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        description: data.description,
      };

      applyDiscountCode(discount);
      setDiscountMessage(`✅ Código "${discountCode.toUpperCase()}" aplicado correctamente`);
      setDiscountCode('');
    } catch (err) {
      console.error('Error applying discount:', err);
      setDiscountMessage('Error al validar el código');
      removeDiscountCode();
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    removeDiscountCode();
    setDiscountMessage(null);
    setDiscountCode('');
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // If guest email field is filled, always use guest checkout
      // This handles stale sessions where cookies persist but user wants guest checkout
      const hasGuestEmail = guestEmail && guestEmail.includes('@');
      
      let accessToken: string | null = null;
      let useGuestCheckout = isGuest || hasGuestEmail;
      
      if (!hasGuestEmail) {
        // Only try auth if no guest email was provided
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session) {
          accessToken = session.access_token;
          useGuestCheckout = false;
        } else {
          useGuestCheckout = true;
          setIsGuest(true);
        }
      }

      // Validate guest email if doing guest checkout
      if (useGuestCheckout) {
        if (!guestEmail || !guestEmail.includes('@')) {
          setError('Por favor, introduce un email válido para recibir la confirmación de tu pedido.');
          setIsProcessing(false);
          return;
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken && !useGuestCheckout) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers,
        credentials: useGuestCheckout ? 'omit' : 'include',
        body: JSON.stringify({
          items: cart.items,
          guestEmail: useGuestCheckout ? guestEmail : undefined,
          discountCode: cart.discountCode?.code,
          discountInfo: cart.discountCode ? {
            discount_type: cart.discountCode.discount_type,
            discount_value: cart.discountCode.discount_value,
          } : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle registered email case - show password field
        if (data.error === 'email_registered') {
          setShowPasswordField(true);
          setPasswordError(null);
          setError(null);
          setIsProcessing(false);
          return;
        }
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

  // Handle login for guest with existing account
  const handleGuestLogin = async () => {
    setIsProcessing(true);
    setPasswordError(null);
    setError(null);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: guestEmail,
        password: guestPassword,
      });

      if (signInError || !signInData.session) {
        setPasswordError('Contraseña incorrecta. Esta cuenta ya existe con ese email.');
        setIsProcessing(false);
        return;
      }

      // Login successful - proceed with authenticated checkout
      setIsGuest(false);
      setShowPasswordField(false);
      setGuestPassword('');
      setPasswordError(null);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signInData.session.access_token}`,
      };

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          items: cart.items,
          discountCode: cart.discountCode?.code,
          discountInfo: cart.discountCode ? {
            discount_type: cart.discountCode.discount_type,
            discount_value: cart.discountCode.discount_value,
          } : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Login checkout error:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Overlay - solo renderizar después de hidratación */}
      {isMounted && cart.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-40"
          onClick={() => closeCart()}
        />
      )}

      {/* Slide Over Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-brand-dark shadow-2xl z-50 transform transition-transform duration-300 ${
          isMounted && cart.isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-brand-gray bg-brand-black">
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">
              Tu Carrito
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
              <div className="text-6xl mb-4 text-neutral-500">•</div>
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
                        onClick={() => {
                          // Obtener el stock máximo para esa talla
                          const maxAvailable = item.product.sizes_available?.[item.size] || 0;
                          if (item.quantity < maxAvailable) {
                            updateCartItemQuantity(
                              item.product_id,
                              item.size,
                              item.quantity + 1
                            );
                          }
                        }}
                        disabled={item.quantity >= (item.product.sizes_available?.[item.size] || 0)}
                        className={`w-8 h-8 bg-brand-black text-white text-sm font-bold transition-colors ${
                          item.quantity >= (item.product.sizes_available?.[item.size] || 0)
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-brand-red'
                        }`}
                      >
                        +
                      </button>
                      <span className="text-xs text-neutral-500 ml-2">
                        / {item.product.sizes_available?.[item.size] || 0}
                      </span>
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
              {/* Discount Code Input */}
              <form onSubmit={handleApplyDiscount} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="Código de descuento"
                    disabled={cart.discountApplied || applyingDiscount}
                    className="flex-1 px-3 py-2 bg-brand-gray text-white placeholder-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!cart.discountApplied ? (
                    <button
                      type="submit"
                      disabled={applyingDiscount || !discountCode.trim()}
                      className="px-4 py-2 bg-brand-red text-white font-bold hover:bg-brand-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {applyingDiscount ? '...' : 'Aplicar'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRemoveDiscount}
                      className="px-4 py-2 bg-brand-gray text-white font-bold hover:bg-neutral-600 transition-colors"
                    >
                      ✕ Quitar
                    </button>
                  )}
                </div>
                
                {discountMessage && (
                  <p className={`text-xs px-2 py-1 ${
                    discountMessage.startsWith('✅') 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }`}>
                    {discountMessage}
                  </p>
                )}
              </form>

              {/* Price Breakdown */}
              <div className="bg-brand-gray p-3 space-y-2 rounded text-sm">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal:</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {cart.discountApplied && cart.discountCode && (
                  <div className="flex justify-between text-green-400 border-t border-brand-dark pt-2">
                    <span>{cart.discountCode.code}</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold border-t border-brand-dark pt-2 text-base">
                  <span>Total:</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 text-sm">
                  {error}
                </div>
              )}

              {/* Guest Email Input - shown when not logged in */}
              {isGuest && (
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400 block">
                    Email para recibir tu pedido:
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      // Reset password flow when email changes
                      if (showPasswordField) {
                        setShowPasswordField(false);
                        setGuestPassword('');
                        setPasswordError(null);
                      }
                    }}
                    placeholder="tu@email.com"
                    className="w-full px-3 py-2 bg-brand-gray text-white placeholder-neutral-500 border border-neutral-600 focus:border-brand-red focus:outline-none"
                  />
                  
                  {/* Password field for registered emails */}
                  {showPasswordField && (
                    <div className="space-y-2 mt-2 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded">
                      <p className="text-sm text-yellow-300">
                        ⚠️ Este email ya tiene una cuenta registrada. Introduce tu contraseña para continuar.
                      </p>
                      <input
                        type="password"
                        value={guestPassword}
                        onChange={(e) => setGuestPassword(e.target.value)}
                        placeholder="Tu contraseña"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && guestPassword) {
                            handleGuestLogin();
                          }
                        }}
                        className="w-full px-3 py-2 bg-brand-gray text-white placeholder-neutral-500 border border-neutral-600 focus:border-brand-red focus:outline-none"
                      />
                      {passwordError && (
                        <p className="text-xs text-red-400">{passwordError}</p>
                      )}
                      <button
                        onClick={handleGuestLogin}
                        disabled={isProcessing || !guestPassword}
                        className="w-full py-2 bg-yellow-600 text-white font-bold uppercase text-sm hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isProcessing ? 'Verificando...' : 'Iniciar sesión y pagar'}
                      </button>
                    </div>
                  )}
                  
                  {!showPasswordField && (
                    <p className="text-xs text-neutral-500">
                      Si te registras con este email en el futuro, podrás ver todos tus pedidos.
                    </p>
                  )}
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
                  'Pagar con Stripe'
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
