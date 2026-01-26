import React, { useState, useEffect } from 'react';
import { login, register, getCurrentUser, initializeAuth, authStore } from '@stores/auth';
import LoadingSpinner from '@components/ui/LoadingSpinner';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('/');

  useEffect(() => {
    // Inicializar auth
    initializeAuth().then(() => {
      const user = getCurrentUser();
      setIsAuthenticated(!!user);
      
      // Si ya está autenticado, redirigir
      if (user) {
        window.location.href = '/';
      }
    });

    // Obtener URL de redirección de los parámetros
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      setRedirectUrl(redirect);
    }

    // Suscribirse a cambios de auth
    const unsubscribe = authStore.subscribe((state) => {
      setIsAuthenticated(!!state.user);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Usar el endpoint API para que guarde las cookies
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // También actualizar el store del cliente
      await login(email, password);

      setSuccess('¡Inicio de sesión exitoso! Redirigiendo...');
      setEmail('');
      setPassword('');
      setIsAuthenticated(true);
      
      // Redirect after login - usando window.location.replace para forzar recarga completa
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('El nombre es requerido');
      setLoading(false);
      return;
    }

    const result = await register(email, password, fullName);
    setLoading(false);

    if (result.success) {
      setSuccess('¡Registro exitoso! Redirigiendo...');
      setEmail('');
      setPassword('');
      setFullName('');
      setIsAuthenticated(true);
      // Redirect after registration
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 500);
    } else {
      setError(result.error || 'Error al registrarse');
    }
  };

  // Show loading spinner while authenticating
  if (loading) {
    return <LoadingSpinner message={isLogin ? 'Iniciando sesión...' : 'Creando tu cuenta...'} fullScreen={true} />;
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-4 animate-fade-in-up">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-brand-dark overflow-hidden shadow-2xl border border-brand-red/20 animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-gray to-brand-black px-6 py-10 text-center border-b-4 border-brand-red relative overflow-hidden">
            <div className="absolute inset-0 animate-shimmer opacity-20"></div>
            <div className="relative z-10">
              <h1 className="text-4xl font-display font-bold text-white uppercase tracking-tight mb-2">
                KICKS<span className="text-brand-red">PREMIUM</span>
              </h1>
              <p className="text-neutral-400 text-sm uppercase tracking-wider">Sneakers Auténticos</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {/* Tabs */}
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3 px-4 font-bold uppercase text-sm tracking-wider transition-all ${
                  isLogin
                    ? 'bg-brand-red text-white shadow-lg shadow-brand-red/50 scale-105'
                    : 'bg-brand-gray text-neutral-400 hover:text-white hover:bg-brand-black'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3 px-4 font-bold uppercase text-sm tracking-wider transition-all ${
                  !isLogin
                    ? 'bg-brand-red text-white shadow-lg shadow-brand-red/50 scale-105'
                    : 'bg-brand-gray text-neutral-400 hover:text-white hover:bg-brand-black'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-500 text-red-400 text-sm animate-slide-in-left rounded">
                <span className="font-bold">⚠️</span> {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-4 bg-green-900/30 border border-green-500 text-green-400 text-sm animate-slide-in-left rounded">
                <span className="font-bold">✓</span> {success}
              </div>
            )}

            {/* Forms */}
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-5">
              {/* Full Name (Register only) */}
              {!isLogin && (
                <div className="animate-slide-in-left">
                  <label className="block text-sm font-bold text-white uppercase tracking-wider mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-gray text-white border border-brand-red/20 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 placeholder-neutral-500 transition-all"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div className="animate-slide-in-left animation-delay-200">
                <label className="block text-sm font-bold text-white uppercase tracking-wider mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-gray text-white border border-brand-red/20 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 placeholder-neutral-500 transition-all"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              {/* Password */}
              <div className="animate-slide-in-left animation-delay-400">
                <label className="block text-sm font-bold text-white uppercase tracking-wider mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-gray text-white border border-brand-red/20 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 placeholder-neutral-500 transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-red text-white font-bold uppercase tracking-wider hover:bg-brand-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-red/50 animate-slide-in-left animation-delay-600"
              >
                {loading
                  ? 'Procesando...'
                  : isLogin
                    ? 'Iniciar Sesión'
                    : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center animate-fade-in-up animation-delay-400">
          <a href="/" className="text-brand-red hover:text-brand-orange font-bold uppercase text-sm transition-colors hover:translate-x-1 inline-block">
            ← Volver a la tienda
          </a>
          <div className="mt-6 space-y-2">
            <p className="text-neutral-500 text-sm">
              ✓ Acceso exclusivo a drops limitados
            </p>
            <p className="text-neutral-500 text-sm">
              ✓ Historial de pedidos y favoritos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
      setIsAuthenticated(true);
      // Redirect after registration
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 500);
    } else {
      setError(result.error || 'Error al registrarse');
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-brand-dark overflow-hidden">
          {/* Header */}
          <div className="bg-brand-gray px-6 py-10 text-center border-b-4 border-brand-red">
            <h1 className="text-4xl font-display font-bold text-white uppercase tracking-tight mb-2">
              KICKS<span className="text-brand-red">PREMIUM</span>
            </h1>
            <p className="text-neutral-400 text-sm uppercase tracking-wider">Sneakers Auténticos</p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {/* Tabs */}
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3 px-4 font-bold uppercase text-sm tracking-wider transition-all ${
                  isLogin
                    ? 'bg-brand-red text-white'
                    : 'bg-brand-gray text-neutral-400 hover:text-white'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3 px-4 font-bold uppercase text-sm tracking-wider transition-all ${
                  !isLogin
                    ? 'bg-brand-red text-white'
                    : 'bg-brand-gray text-neutral-400 hover:text-white'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-500 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-4 bg-green-900/30 border border-green-500 text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Forms */}
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-5">
              {/* Full Name (Register only) */}
              {!isLogin && (
                <div>
                  <label className="block text-sm font-bold text-white uppercase tracking-wider mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-gray text-white border-0 focus:outline-none focus:ring-2 focus:ring-brand-red placeholder-neutral-500"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-white uppercase tracking-wider mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-gray text-white border-0 focus:outline-none focus:ring-2 focus:ring-brand-red placeholder-neutral-500"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-white uppercase tracking-wider mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-gray text-white border-0 focus:outline-none focus:ring-2 focus:ring-brand-red placeholder-neutral-500"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-red text-white font-bold uppercase tracking-wider hover:bg-brand-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
              >
                {loading
                  ? 'Procesando...'
                  : isLogin
                    ? 'Iniciar Sesión'
                    : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <a href="/" className="text-brand-red hover:text-brand-orange font-bold uppercase text-sm">
            ← Volver a la tienda
          </a>
          <div className="mt-6 space-y-2">
            <p className="text-neutral-500 text-sm">
              ✓ Acceso exclusivo a drops limitados
            </p>
            <p className="text-neutral-500 text-sm">
              ✓ Historial de pedidos y favoritos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
