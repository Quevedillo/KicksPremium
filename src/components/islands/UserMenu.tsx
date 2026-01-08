import React, { useEffect, useState } from 'react';
import { authStore, logout, getCurrentUser } from '@stores/auth';

export default function UserMenu() {
  const [user, setUser] = useState(getCurrentUser());
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = authStore.subscribe((state) => {
      setUser(state.user);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="px-4 py-2 bg-brand-navy text-white rounded hover:bg-brand-charcoal transition-colors text-sm font-semibold"
      >
        Iniciar Sesión
      </a>
    );
  }

  const userName = user.user_metadata?.full_name || user.email || 'Usuario';

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-4 py-2 bg-neutral-200 text-brand-navy rounded hover:bg-neutral-300 transition-colors text-sm font-semibold flex items-center gap-2"
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

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg z-50">
          <div className="p-3 border-b border-neutral-200">
            <p className="text-xs text-neutral-600">Conectado como:</p>
            <p className="font-semibold text-sm text-brand-navy truncate">{user.email}</p>
          </div>

          <a
            href="/mi-cuenta"
            className="block px-4 py-2 text-sm text-brand-navy hover:bg-neutral-100 transition-colors"
            onClick={() => setShowMenu(false)}
          >
            Mi Cuenta
          </a>

          <a
            href="/pedidos"
            className="block px-4 py-2 text-sm text-brand-navy hover:bg-neutral-100 transition-colors"
            onClick={() => setShowMenu(false)}
          >
            Mis Pedidos
          </a>

          <button
            onClick={() => {
              setShowMenu(false);
              handleLogout();
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-neutral-200 font-semibold"
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}
