import { atom } from 'nanostores';
import type { CartItem, Product } from '../lib/supabase'; // Update this path based on where supabase.ts is located

export interface DiscountCode {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  description?: string;
}

export interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  discountCode?: DiscountCode | null;
  discountApplied?: boolean;
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
      return JSON.parse(stored);
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

// Actions
export const addToCart = (product: Product, quantity: number, size: string) => {
  const current = cartStore.get();
  const existingItem = current.items.find(
    (item) => item.product_id === product.id && item.size === size
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    current.items.push({
      product_id: product.id,
      product,
      quantity,
      size,
    });
  }

  cartStore.set({ ...current, items: current.items });
};

export const removeFromCart = (productId: string, size: string) => {
  const current = cartStore.get();
  current.items = current.items.filter(
    (item) => !(item.product_id === productId && item.size === size)
  );
  cartStore.set({ ...current, items: current.items });
};

export const updateCartItemQuantity = (
  productId: string,
  size: string,
  quantity: number
) => {
  const current = cartStore.get();
  const item = current.items.find(
    (item) => item.product_id === productId && item.size === size
  );

  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId, size);
    } else {
      item.quantity = quantity;
      cartStore.set({ ...current, items: current.items });
    }
  }
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

// Calculated values
export const getCartSubtotal = (): number => {
  const current = cartStore.get();
  return current.items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
};

export const getDiscountAmount = (): number => {
  const current = cartStore.get();
  const subtotal = getCartSubtotal();
  
  if (!current.discountCode || !current.discountApplied) {
    return 0;
  }

  const discount = current.discountCode;
  
  if (discount.discount_type === 'percentage') {
    return Math.round((subtotal * discount.discount_value) / 100);
  } else if (discount.discount_type === 'fixed') {
    return discount.discount_value;
  }
  
  return 0;
};

export const getCartTotal = (): number => {
  const subtotal = getCartSubtotal();
  const discount = getDiscountAmount();
  return Math.max(0, subtotal - discount);
};

export const getCartItemCount = (): number => {
  const current = cartStore.get();
  return current.items.reduce((count, item) => count + item.quantity, 0);
};
