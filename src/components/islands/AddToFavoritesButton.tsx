import React, { useEffect, useState } from 'react';
import { authStore, getCurrentUser } from '@stores/auth';
import type { Product } from '@lib/supabase';

interface AddToFavoritesButtonProps {
  product: Product;
}

export default function AddToFavoritesButton({ product }: AddToFavoritesButtonProps) {
  const [user, setUser] = useState(getCurrentUser());
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    const unsubscribe = authStore.subscribe((state) => {
      setUser(state.user);
    });

    return () => unsubscribe();
  }, []);

  // Cargar estado de favorito si el usuario está autenticado
  useEffect(() => {
    if (user) {
      checkIfFavorite();
    } else {
      setIsFavorite(false);
    }
  }, [user, product.id]);

  const checkIfFavorite = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(
        `/api/favorites/check?productId=${product.id}`,
        {
          headers: {
            'Authorization': `Bearer ${user.id}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);
      }
    } catch (error) {
      console.error('Error checking favorite:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      setFeedback('Inicia sesión para agregar a favoritos');
      window.location.href = '/auth/login?redirect=/productos/' + product.slug;
      return;
    }

    setIsLoading(true);
    setFeedback('');

    try {
      const method = isFavorite ? 'DELETE' : 'POST';
      const response = await fetch(
        `/api/favorites/${product.id}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`
          }
        }
      );

      if (response.ok) {
        setIsFavorite(!isFavorite);
        setFeedback(isFavorite ? 'Removido de favoritos' : 'Agregado a favoritos');
        setTimeout(() => setFeedback(''), 2000);
      } else {
        setFeedback('Error al guardar favorito');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setFeedback('Error al guardar favorito');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleToggleFavorite}
        disabled={isLoading}
        className={`w-full py-2 px-4 font-semibold transition-all rounded flex items-center justify-center gap-2 ${
          isFavorite
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : 'bg-neutral-200 text-brand-navy hover:bg-neutral-300'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={user ? (isFavorite ? 'Remover de favoritos' : 'Agregar a favoritos') : 'Inicia sesión para agregar a favoritos'}
      >
        <span className="text-lg">{isFavorite ? 'Favorito' : 'No favorito'}</span>
        <span className="text-sm">{isFavorite ? 'Favorito' : 'Agregar'}</span>
      </button>

      {feedback && (
        <p className={`text-xs text-center ${feedback.includes('Agregado') || feedback.includes('Removido') ? 'text-green-600' : 'text-brand-navy'}`}>
          {feedback}
        </p>
      )}

      {!user && (
        <p className="text-xs text-neutral-600 text-center">
          Inicia sesión para guardar favoritos
        </p>
      )}
    </div>
  );
}
