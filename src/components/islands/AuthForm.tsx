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

    if (result.success) {
      // Después de registro exitoso, llamar al API de login para guardar cookies de sesión
      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch (err) {
        console.warn('Error setting login cookies after register:', err);
      }

      setLoading(false);
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
      setLoading(false);
      setError(result.error || 'Error al registrarse');
    }
  };

  // Show loading spinner while authenticating
  if (loading) {
    return <LoadingSpinner message={isLogin ? 'Iniciando sesión...' : 'Creando tu cuenta...'} fullScreen={true} />;
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-brand-dark overflow-hidden border border-brand-red/30 shadow-2xl shadow-brand-red/20">
          {/* Header Premium */}
          <div className="bg-gradient-to-r from-brand-red/20 to-transparent px-6 py-8 text-center border-b border-brand-red/20">
            <div className="mb-4">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-tight">
                KICKS<span className="text-brand-red">PREMIUM</span>
              </h1>
            </div>
            <p className="text-neutral-400 text-xs uppercase tracking-widest letter-spacing">
              {isLogin ? 'Acceso a Cuenta' : 'Únete a la Comunidad'}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {/* Tab Navigation - Mejorada */}
            <div className="flex gap-0 mb-8 bg-brand-gray/20 p-1 rounded-lg">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3 px-4 font-bold uppercase text-xs tracking-wider transition-all duration-300 rounded ${
                  isLogin
                    ? 'bg-brand-red text-white shadow-lg shadow-brand-red/40'
                    : 'text-neutral-400 hover:text-white'
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
                className={`flex-1 py-3 px-4 font-bold uppercase text-xs tracking-wider transition-all duration-300 rounded ${
                  !isLogin
                    ? 'bg-brand-red text-white shadow-lg shadow-brand-red/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-5 p-4 bg-red-900/20 border border-red-500/50 text-red-300 text-sm rounded-lg flex gap-3 items-start">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 p-4 bg-green-900/20 border border-green-500/50 text-green-300 text-sm rounded-lg flex gap-3 items-start">
                <span className="text-lg">✓</span>
                <span>{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
              {/* Full Name - Solo registro */}
              {!isLogin && (
                <div>
                  <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-gray/50 text-white border border-brand-red/20 rounded-lg focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/30 placeholder-neutral-500 transition-all"
                    placeholder="Juan Pérez García"
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-gray/50 text-white border border-brand-red/20 rounded-lg focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/30 placeholder-neutral-500 transition-all"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-gray/50 text-white border border-brand-red/20 rounded-lg focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/30 placeholder-neutral-500 transition-all"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>

              {/* Submit Button - Diseño mejorado */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-red text-white font-bold uppercase tracking-wider rounded-lg hover:bg-brand-orange transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-brand-red/30 hover:shadow-brand-red/50 mt-6"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </span>
                ) : isLogin ? (
                  '🔓 Iniciar Sesión'
                ) : (
                  '✨ Crear Cuenta'
                )}
              </button>
            </form>

            {/* Info Section */}
            <div className="mt-6 pt-6 border-t border-brand-gray/20">
              <p className="text-xs text-neutral-400 text-center mb-4">
                {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'} 
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccess('');
                  }}
                  className="ml-2 text-brand-red hover:text-brand-orange font-bold transition-colors"
                >
                  {isLogin ? 'Regístrate aquí' : 'Inicia sesión aquí'}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Access Footer */}
        <div className="mt-6 text-center space-y-3">
          <a 
            href="/" 
            className="inline-block text-brand-red hover:text-brand-orange font-bold uppercase text-sm transition-colors hover:-translate-x-1"
          >
            ← Volver a la tienda
          </a>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <a href="/productos" className="text-neutral-400 hover:text-white transition-colors py-2 px-3 bg-brand-dark rounded-lg border border-brand-gray/20 hover:border-brand-red/50">
              📦 Catálogo
            </a>
            <a href="/categoria/travis-scott" className="text-neutral-400 hover:text-white transition-colors py-2 px-3 bg-brand-dark rounded-lg border border-brand-gray/20 hover:border-brand-red/50">
              👟 Travis
            </a>
            <a href="/categoria/jordan-special" className="text-neutral-400 hover:text-white transition-colors py-2 px-3 bg-brand-dark rounded-lg border border-brand-gray/20 hover:border-brand-red/50">
              🏀 Jordan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
