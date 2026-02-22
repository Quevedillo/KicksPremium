/**
 * Tipos de base de datos para KicksPremium.
 * Definiciones centralizadas para todas las entidades del sistema.
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order?: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  detailed_description?: ProductDetailedDescription;
  price: number; // en céntimos
  original_price?: number; // MSRP original en céntimos
  stock: number;
  category_id: string;
  images: string[];

  // Campos específicos de sneakers
  brand: string;
  model?: string;
  colorway?: string;
  sku: string;
  release_date?: string;
  is_limited_edition?: boolean;
  release_type?: 'standard' | 'restock' | 'limited';
  sizes_available?: Record<string, number>; // { "36": 5, "37": 3, ... }
  tags?: string[];

  // Descuentos
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number | null;

  created_at: string;
  updated_at: string;
}

export interface ProductDetailedDescription {
  materials?: string;
  fit?: string;
  care_instructions?: string;
  [key: string]: string | undefined;
}

export interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
  size: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  total: number;
  subtotal: number;
  discount_amount?: number;
  shipping_cost?: number;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  shipping_address?: ShippingAddress;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  size: string;
  quantity: number;
  unit_price: number;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  is_admin: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  description?: string;
  min_purchase?: number;
  max_uses?: number;
  current_uses?: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at?: string;
}

/**
 * Item de pedido normalizado desde formato compacto (Stripe metadata) o completo.
 * Utilizado como tipo canónico en todo el flujo de pedidos, facturas y emails.
 */
export interface NormalizedOrderItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  qty: number;
  size: string;
  img: string;
}

/**
 * Resultado de operación RPC de stock (reduce_size_stock / add_size_stock)
 */
export interface StockRpcResult {
  success: boolean;
  error?: string;
  size?: string;
  previous_qty?: number;
  new_qty?: number;
  available?: number;
  requested?: number;
  sizes_available?: Record<string, number>;
}
