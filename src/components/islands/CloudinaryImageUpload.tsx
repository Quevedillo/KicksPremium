import React, { useState, useRef, useEffect } from 'react';

interface ImageUploadProps {
  onImagesSelected?: (images: ImageData[]) => void;
  maxFiles?: number;
  existingImages?: string[];
}

export interface ImageData {
  publicId: string;
  url: string;
  width: number;
  height: number;
}

export const CloudinaryImageUpload: React.FC<ImageUploadProps> = ({
  onImagesSelected,
  maxFiles = 5,
  existingImages = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<ImageData[]>([]);
  const [currentMaxFiles, setCurrentMaxFiles] = useState(maxFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emit custom event when images change
  const emitImagesUpdated = (images: ImageData[]) => {
    // Emit event with just the URLs since that's what the form needs
    const urls = images.map(img => img.url);
    const event = new CustomEvent('cloudinary-images-updated', {
      detail: { images: urls }
    });
    window.dispatchEvent(event);
    console.log('Emitted cloudinary-images-updated with URLs:', urls);
  };

  // Listen for max files update from parent
  useEffect(() => {
    const handleMaxFilesUpdate = (e: CustomEvent) => {
      setCurrentMaxFiles(e.detail.maxFiles);
    };
    
    window.addEventListener('cloudinary-max-files-updated', handleMaxFilesUpdate as EventListener);
    return () => {
      window.removeEventListener('cloudinary-max-files-updated', handleMaxFilesUpdate as EventListener);
    };
  }, []);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter((file) => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError(`${file.name} no es un tipo de imagen válido`);
        return false;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} excede el tamaño máximo de 10MB`);
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const newImages: ImageData[] = [];

      // Obtener token de Supabase desde localStorage
      let accessToken = '';
      try {
        // Supabase guarda la sesión en sb-auth-token como string JSON
        const storedSession = localStorage.getItem('sb-auth-token');
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          // El formato puede variar: directamente access_token o dentro de session
          accessToken = parsed.access_token || parsed.session?.access_token || '';
        }
        
        // También intentar con el formato alternativo de Supabase
        if (!accessToken) {
          // Buscar cualquier clave que empiece con sb- y contenga token
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('sb-') || key.includes('supabase'))) {
              try {
                const value = localStorage.getItem(key);
                if (value) {
                  const data = JSON.parse(value);
                  if (data.access_token) {
                    accessToken = data.access_token;
                    break;
                  }
                  if (data.session?.access_token) {
                    accessToken = data.session.access_token;
                    break;
                  }
                }
              } catch {
                // Ignorar si no es JSON válido
              }
            }
          }
        }
      } catch (e) {
        console.warn('No se pudo obtener token de localStorage:', e);
      }

      for (const file of validFiles) {
        if (uploadedImages.length + newImages.length >= currentMaxFiles) {
          setError(`Máximo ${currentMaxFiles} imágenes permitidas`);
          break;
        }

        const formData = new FormData();
        formData.append('file', file);

        const headers: HeadersInit = {
          'X-Requested-With': 'XMLHttpRequest', // Evita bloqueos CSRF de proxies
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        console.log('[Upload] Enviando imagen:', { 
          hasToken: !!accessToken, 
          fileName: file.name, 
          fileSize: file.size 
        });

        const response = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers,
        });

        if (!response.ok) {
          // Capturar el texto crudo de la respuesta para diagnosticar
          let errorMessage = `Error ${response.status}`;
          try {
            const rawText = await response.text();
            console.error('[Upload] Respuesta del servidor:', response.status, rawText);
            try {
              const errorData = JSON.parse(rawText);
              errorMessage = errorData.error || errorData.message || errorMessage;
              if (errorData.debug) {
                console.error('[Upload] Debug info:', errorData.debug);
              }
            } catch {
              // La respuesta no es JSON - probablemente viene del proxy
              errorMessage = `Error ${response.status}: ${rawText.substring(0, 200)}`;
            }
          } catch {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        newImages.push({
          publicId: data.publicId,
          url: data.url,
          width: data.width,
          height: data.height,
        });
      }

      const allImages = [...uploadedImages, ...newImages];
      setUploadedImages(allImages);
      onImagesSelected?.(allImages);
      emitImagesUpdated(allImages); // Emit all accumulated images
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error desconocido al subir imágenes'
      );
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    onImagesSelected?.(newImages);
    emitImagesUpdated(newImages);
  };

  const availableSlots = currentMaxFiles - uploadedImages.length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-brand-navy transition-colors cursor-pointer"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('border-brand-navy', 'bg-brand-navy/5');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('border-brand-navy', 'bg-brand-navy/5');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-brand-navy', 'bg-brand-navy/5');
          handleFileSelect(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={loading}
        />

        <p className="text-neutral-600 mb-2">
          {loading ? 'Subiendo imágenes...' : 'Arrastra y suelta imágenes aquí o haz clic para seleccionar'}
        </p>
        <p className="text-sm text-neutral-500">
          PNG, JPG, GIF, WebP (máx. 10MB cada una)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-neutral-900 mb-3">
            Nuevas imágenes ({uploadedImages.length}/{currentMaxFiles})
          </p>
          <div className="grid grid-cols-3 gap-4">
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.url}
                  alt={`Producto ${idx + 1}`}
                  className="w-full h-32 object-cover rounded border border-neutral-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden input para almacenar URLs */}
      <input
        type="hidden"
        name="cloudinaryImages"
        value={JSON.stringify(uploadedImages)}
      />
    </div>
  );
};
