import { v2 as cloudinary } from 'cloudinary';

const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = import.meta.env.CLOUDINARY_API_KEY;
const apiSecret = import.meta.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'Missing Cloudinary configuration. Please check your .env.local file.'
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export { cloudinary };

/**
 * Generar URL optimizada de imagen en Cloudinary
 * @param publicId ID público de la imagen en Cloudinary
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
  }
): string => {
  const width = options?.width || 800;
  const height = options?.height || 600;
  const quality = options?.quality || 'auto';
  const format = options?.format || 'webp';

  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality,
    format,
    secure: true,
  });
};

/**
 * Obtener URL de imagen con transformaciones para galerías
 * @param publicId ID público de la imagen
 * @returns URL optimizada para galería
 */
export const getGalleryImageUrl = (publicId: string): string => {
  return getCloudinaryUrl(publicId, {
    width: 1200,
    height: 1200,
    quality: 'auto',
    format: 'webp',
  });
};

/**
 * Obtener URL de imagen para thumbnail
 * @param publicId ID público de la imagen
 * @returns URL optimizada para thumbnail
 */
export const getThumbnailUrl = (publicId: string): string => {
  return getCloudinaryUrl(publicId, {
    width: 300,
    height: 300,
    quality: 'auto',
    format: 'webp',
  });
};
