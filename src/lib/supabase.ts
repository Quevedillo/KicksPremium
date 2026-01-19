import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please check your .env file.'
  );
}

// Singleton cliente con configuración mejorada para evitar AbortError
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: crear nuevo cliente cada vez
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  
  // Client-side: usar singleton con configuración optimizada
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'sb-auth-token',
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

// Server-side client with service role (use only in API routes)
export const getSupabaseServiceClient = () => {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey);
};

// Types for database
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
  detailed_description?: Record<string, any>; // { materials, fit, care_instructions }
  price: number; // in cents
  original_price?: number; // MSRP original
  stock: number;
  category_id: string;
  images: string[];
  
  // Zapatos-specific fields
  brand: string; // Jordan, Adidas, Nike, etc.
  model?: string; // AJ1, Yeezy 700, etc.
  colorway?: string; // Red Toe, Bred, Chicago, etc.
  sku: string; // Identificador único por modelo/talla
  release_date?: string;
  is_limited_edition?: boolean;
  release_type?: 'standard' | 'restock' | 'limited'; // Tipo de lanzamiento
  sizes_available?: Record<string, number>; // { "36": 5, "37": 3, ... }
  tags?: string[]; // Array: ['hyped', 'upcoming', 'popular', 'new']
  
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
  size: string;
}
