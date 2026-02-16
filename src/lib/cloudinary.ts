import { v2 as cloudinary } from 'cloudinary';

let isConfigured = false;

/**
 * Inicializa Cloudinary bajo demanda (lazy init).
 * Evita crash al importar el módulo si faltan variables de entorno.
 */
function ensureConfigured(): void {
  if (isConfigured) return;

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = import.meta.env.CLOUDINARY_API_KEY;
  const apiSecret = import.meta.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Missing Cloudinary configuration. Please check your .env file for PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  isConfigured = true;
}

/**
 * Obtiene la instancia configurada de Cloudinary.
 * Configura las credenciales en la primera llamada.
 */
export const getCloudinary = () => {
  ensureConfigured();
  return cloudinary;
};

// Export por compatibilidad con código existente que importe { cloudinary }
export { cloudinary };

/**
 * Generar URL optimizada de imagen en Cloudinary
 * @param publicId ID público de la imagen en Cloudinary o URL completa
 * @param options Opciones de transformación
 * @returns URL de la imagen
 */
export const getCloudinaryUrl = (
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
    crop?: 'fill' | 'fit' | 'scale' | 'pad';
    gravity?: string;
    aspect_ratio?: string;
  }
): string => {
  // Si es una URL completa de Cloudinary, transformarla
  if (publicId.includes('cloudinary.com')) {
    return publicId; // Ya está optimizada
  }

  const width = options?.width || 800;
  const height = options?.height || 600;
  const quality = options?.quality || 'auto';
  const format = options?.format || 'webp';
  const crop = options?.crop || 'fill';
  const gravity = options?.gravity || 'auto';
  const aspectRatio = options?.aspect_ratio;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    gravity,
    quality,
    format,
    secure: true,
    ...(aspectRatio && { aspect_ratio: aspectRatio }),
  }) as string;
};

/**
 * Obtener URL de imagen con transformaciones para galerías
 * @param publicId ID público de la imagen o URL completa
 * @returns URL optimizada para galería
 */
export const getGalleryImageUrl = (publicId: string): string => {
  return getCloudinaryUrl(publicId, {
    width: 1200,
    height: 1200,
    quality: 'auto',
    format: 'webp',
    crop: 'fill',
    gravity: 'auto',
  });
};

/**
 * Obtener URL de imagen para thumbnail
 * @param publicId ID público de la imagen o URL completa
 * @returns URL optimizada para thumbnail
 */
export const getThumbnailUrl = (publicId: string): string => {
  return getCloudinaryUrl(publicId, {
    width: 300,
    height: 300,
    quality: 'auto',
    format: 'webp',
    crop: 'fill',
  });
};

/**
 * Obtener URL de imagen responsiva para diferentes tamaños
 * @param publicId ID público de la imagen o URL completa
 * @param sizes Tamaños a generar
 * @returns Objeto con URLs para cada tamaño
 */
export const getResponsiveImageUrls = (
  publicId: string,
  sizes: number[] = [300, 600, 1200]
) => {
  return sizes.reduce((acc, size) => {
    acc[`w${size}`] = getCloudinaryUrl(publicId, {
      width: size,
      height: size,
      quality: 'auto',
      format: 'webp',
      crop: 'fill',
    });
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Obtener URL con aspecto específico
 * @param publicId ID público de la imagen
 * @param aspectRatio Relación de aspecto (ej: "16:9", "1:1", "4:3")
 * @returns URL optimizada con aspecto específico
 */
export const getAspectRatioUrl = (
  publicId: string,
  aspectRatio: string = '1:1'
): string => {
  return getCloudinaryUrl(publicId, {
    width: 1000,
    height: 1000,
    aspect_ratio: aspectRatio,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'webp',
  });
};
