import React, { useEffect, useState } from 'react';
import { authStore, initializeAuth } from '@stores/auth';

interface Props {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: Props) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      // Inicializar auth si no está listo
      await initializeAuth();
      
      if (!mounted) return;

      const state = authStore.get();
      
      if (!state.user) {
        window.location.href = '/auth/login';
        return;
      }
      
      if (!state.isAdmin) {
        window.location.href = '/';
        return;
      }
      
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAdmin();
    
    return () => { mounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
          <p className="mt-4 text-neutral-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
