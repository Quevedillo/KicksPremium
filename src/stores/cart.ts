import { atom, computed } from 'nanostores';
import type { CartItem, Product } from '@lib/types';

export interface DiscountCode {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  description?: string;
}

export interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  discountCode: DiscountCode | null;
  discountApplied: boolean;
}

const initialState: CartStore = {
  items: [],
  isOpen: false,
  discountCode: null,
  discountApplied: false,
};

// Load cart from localStorage on client side
const getInitialCart = (): CartStore => {
  if (typeof window === 'undefined') {
    return initialState;
  }

  const stored = localStorage.getItem('kickspremium-cart');
  if (stored) {
    try {
      return { ...initialState, ...JSON.parse(stored) };
    } catch {
      return initialState;
    }
  }
  return initialState;
};

export const cartStore = atom<CartStore>(getInitialCart());

// Save to localStorage whenever cart changes
cartStore.subscribe((value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('kickspremium-cart', JSON.stringify(value));
  }
});

// Actions - Todas con actualizaciones inmutables
export const addToCart = (product: Product, quantity: number, size: string) => {
  const current = cartStore.get();
  const existingIndex = current.items.findIndex(
    (item) => item.product_id === product.id && item.size === size
  );

  // Calcular stock máximo para esta talla
  const maxStock = product.sizes_available?.[size]
    ? parseInt(String(product.sizes_available[size])) || 0
    : 0;

  // Calcular cuántos ya hay en el carrito para este producto+talla
  const currentInCart = existingIndex >= 0 ? current.items[existingIndex].quantity : 0;
  
  // Limitar la cantidad a no exceder el stock disponible
  const maxCanAdd = Math.max(0, maxStock - currentInCart);
  const actualQuantity = Math.min(quantity, maxCanAdd);

  if (actualQuantity <= 0) return; // No añadir si ya se alcanzó el límite

  let newItems: CartItem[];
  if (existingIndex >= 0) {
    newItems = current.items.map((item, i) =>
      i === existingIndex ? { ...item, quantity: item.quantity + actualQuantity } : item
    );
  } else {
    newItems = [...current.items, { product_id: product.id, product, quantity: actualQuantity, size }];
  }

  cartStore.set({ ...current, items: newItems });
};

export const removeFromCart = (productId: string, size: string) => {
  const current = cartStore.get();
  const newItems = current.items.filter(
    (item) => !(item.product_id === productId && item.size === size)
  );
  cartStore.set({ ...current, items: newItems });
};

export const updateCartItemQuantity = (
  productId: string,
  size: string,
  quantity: number
) => {
  if (quantity <= 0) {
    removeFromCart(productId, size);
    return;
  }

  const current = cartStore.get();
  const newItems = current.items.map((item) =>
    item.product_id === productId && item.size === size
      ? { ...item, quantity }
      : item
  );
  cartStore.set({ ...current, items: newItems });
};

export const applyDiscountCode = (discount: DiscountCode) => {
  const current = cartStore.get();
  cartStore.set({ 
    ...current, 
    discountCode: discount,
    discountApplied: true 
  });
};

export const removeDiscountCode = () => {
  const current = cartStore.get();
  cartStore.set({ 
    ...current, 
    discountCode: null,
    discountApplied: false 
  });
};

export const clearCart = () => {
  cartStore.set({ items: [], isOpen: false, discountCode: null, discountApplied: false });
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kickspremium-cart');
  }
};

export const toggleCart = () => {
  const current = cartStore.get();
  cartStore.set({ ...current, isOpen: !current.isOpen });
};

export const openCart = () => {
  const current = cartStore.get();
  cartStore.set({ ...current, isOpen: true });
};

export const closeCart = () => {
  const current = cartStore.get();
  cartStore.set({ ...current, isOpen: false });
};

// Valores computados reactivos - se actualizan automáticamente con el store
export const cartSubtotal = computed(cartStore, (cart) =>
  cart.items.reduce((total, item) => total + item.product.price * item.quantity, 0)
);

export const discountAmount = computed(cartStore, (cart) => {
  const subtotal = cart.items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  if (!cart.discountCode || !cart.discountApplied) return 0;

  if (cart.discountCode.discount_type === 'percentage') {
    return Math.round((subtotal * cart.discountCode.discount_value) / 100);
  } else if (cart.discountCode.discount_type === 'fixed') {
    return cart.discountCode.discount_value;
  }
  return 0;
});

export const cartTotal = computed(cartStore, (cart) => {
  const subtotal = cart.items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  let discount = 0;
  if (cart.discountCode && cart.discountApplied) {
    if (cart.discountCode.discount_type === 'percentage') {
      discount = Math.round((subtotal * cart.discountCode.discount_value) / 100);
    } else if (cart.discountCode.discount_type === 'fixed') {
      discount = cart.discountCode.discount_value;
    }
  }
  return Math.max(0, subtotal - discount);
});

export const cartItemCount = computed(cartStore, (cart) =>
  cart.items.reduce((count, item) => count + item.quantity, 0)
);

// Funciones legacy para compatibilidad con código existente
export const getCartSubtotal = (): number => cartSubtotal.get();
export const getDiscountAmount = (): number => discountAmount.get();
export const getCartTotal = (): number => cartTotal.get();
export const getCartItemCount = (): number => cartItemCount.get();

/** Obtener cuántos pares de un producto+talla ya hay en el carrito */
export const getCartQuantityForSize = (productId: string, size: string): number => {
  const cart = cartStore.get();
  const item = cart.items.find(i => i.product_id === productId && i.size === size);
  return item ? item.quantity : 0;
};
