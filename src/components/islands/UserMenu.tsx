import React, { useEffect, useState } from 'react';
import { authStore, logout, getCurrentUser, initializeAuth } from '@stores/auth';

export default function UserMenu() {
  const [user, setUser] = useState(getCurrentUser());
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted first
    setIsMounted(true);
    
    // Inicializar auth al montar el componente
    initializeAuth().then(() => {
      setUser(getCurrentUser());
      setIsLoading(false);
    });

    const unsubscribe = authStore.subscribe((state) => {
      setUser(state.user);
      setIsLoading(state.isLoading && !state.initialized);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    // Limpiar todo y recargar - sin async para evitar bloqueos
    localStorage.clear();
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    document.cookie = 'sb-refresh-token=; path=/; max-age=0';
    window.location.href = '/';
  };

  // Mostrar loading mientras se inicializa
  if (isLoading) {
    return (
      <div className="px-4 py-2 bg-brand-gray text-neutral-500 text-sm">
        ...
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="px-4 py-2 bg-brand-red text-white hover:bg-brand-orange transition-colors text-sm font-bold uppercase"
      >
        Entrar
      </a>
    );
  }

  const userName = user.user_metadata?.full_name || user.email || 'Usuario';

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-4 py-2 bg-brand-gray text-white hover:bg-brand-red transition-colors text-sm font-bold flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <span>{userName.split(' ')[0]}</span>
      </button>

      {/* Dropdown Menu - solo renderizar después de hidratación */}
      {isMounted && showMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-brand-dark border border-brand-gray shadow-lg z-50">
          <div className="p-3 border-b border-brand-gray">
            <p className="text-xs text-neutral-500">Conectado como:</p>
            <p className="font-bold text-sm text-white truncate">{user.email}</p>
          </div>

          <a
            href="/mi-cuenta"
            className="block px-4 py-3 text-sm text-white hover:bg-brand-red transition-colors"
            onClick={() => setShowMenu(false)}
          >
            Mi Cuenta
          </a>

          <a
            href="/pedidos"
            className="block px-4 py-3 text-sm text-white hover:bg-brand-red transition-colors"
            onClick={() => setShowMenu(false)}
          >
            Mis Pedidos
          </a>

          <button
            onClick={() => {
              setShowMenu(false);
              handleLogout();
            }}
            className="w-full text-left px-4 py-3 text-sm text-brand-red hover:bg-brand-red hover:text-white transition-colors border-t border-brand-gray font-bold"
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}
