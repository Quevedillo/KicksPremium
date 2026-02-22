/**
 * Utility functions for KicksPremium
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedOrderItem } from './types';

/** Formateador de precios para España (EUR) */
const priceFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

/**
 * Formatea un precio de céntimos a string con moneda.
 * @param cents Precio en céntimos
 * @returns Precio formateado (ej: "99,99 €")
 */
export const formatPrice = (cents: number): string => {
  if (!Number.isFinite(cents)) return '0,00 €';
  return priceFormatter.format(cents / 100);
};

/**
 * Crea un slug URL-friendly a partir de texto.
 * @param text Texto a convertir
 * @returns Slug URL-friendly
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Valida formato de email.
 * @param email Email a validar
 * @returns true si el formato es válido
 */
export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Trunca texto a longitud máxima con elipsis.
 * @param text Texto a truncar
 * @param length Longitud máxima
 * @returns Texto truncado
 */
export const truncateText = (text: string, length: number): string => {
  if (!text || text.length <= length) return text || '';
  return text.slice(0, length) + '...';
};

/**
 * Obtiene iniciales de un nombre.
 * @param name Nombre completo
 * @returns Iniciales (ej: "JD" de "John Doe")
 */
export const getInitials = (name: string): string => {
  if (!name || !name.trim()) return '';
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
};

/**
 * Pausa la ejecución durante los milisegundos especificados.
 * @param ms Milisegundos de espera
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Clon profundo de un objeto usando structuredClone.
 * @param obj Objeto a clonar
 * @returns Clon independiente del objeto
 */
export const deepClone = <T>(obj: T): T => {
  return structuredClone(obj);
};

/**
 * Normaliza un item de pedido desde formato compacto (Stripe metadata) o completo.
 * Formato compacto: {id, n, p, q, s}
 * Formato completo: {id, name, brand, price, qty/quantity, size, img/image}
 * @returns Item normalizado con campos estándar
 */
export function normalizeOrderItem(item: Record<string, unknown>): NormalizedOrderItem {
  const asStr = (v: unknown): string => typeof v === 'string' ? v : '';
  const asNum = (v: unknown): number => typeof v === 'number' ? v : 0;
  const product = item.product as Record<string, unknown> | undefined;
  return {
    id: asStr(item.id) || asStr(item.product_id) || '',
    name: asStr(item.name) || asStr(item.n) || 'Producto',
    brand: asStr(item.brand) || '',
    price: asNum(item.price) || asNum(item.p) || 0,
    qty: asNum(item.qty) || asNum(item.q) || asNum(item.quantity) || 1,
    size: asStr(item.size) || asStr(item.s) || '',
    img: asStr(item.img) || asStr(item.image) || asStr(product?.images && Array.isArray(product.images) ? product.images[0] : '') || '',
  };
}

/**
 * Enriquece items de pedido buscando datos completos del producto en la BD.
 * Necesario porque Stripe metadata guarda formato compacto sin nombre completo, marca ni imagen.
 * @param supabaseClient Cliente Supabase (service client recomendado)
 * @param items Array de items (compactos o completos)
 * @returns Items enriquecidos con nombre, marca, imagen y precio real del producto
 */
export async function enrichOrderItems(supabaseClient: SupabaseClient, items: Record<string, unknown>[]): Promise<NormalizedOrderItem[]> {
  const enriched: NormalizedOrderItem[] = [];
  for (const item of items) {
    const normalized = normalizeOrderItem(item);

    // Si ya tiene nombre real (no truncado ni genérico) e imagen, no necesita enriquecer
    if (normalized.name !== 'Producto' && normalized.name.length > 5 && normalized.img) {
      enriched.push(normalized);
      continue;
    }

    // Buscar producto en la BD para obtener datos completos
    if (normalized.id) {
      try {
        const { data: product } = await supabaseClient
          .from('products')
          .select('name, brand, images, price')
          .eq('id', normalized.id)
          .single();

        if (product) {
          normalized.name = product.name || normalized.name;
          normalized.brand = product.brand || normalized.brand;
          normalized.img = product.images?.[0] || normalized.img;
          // Usar el precio del item (ya pagado), no el precio actual del producto
        }
      } catch (e) {
        console.warn(`No se pudo enriquecer producto ${normalized.id}`);
      }
    }

    enriched.push(normalized);
  }
  return enriched;
}
