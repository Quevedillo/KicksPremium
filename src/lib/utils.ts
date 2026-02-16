/**
 * Utility functions for KicksPremium
 */

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
