import React, { useState, useEffect } from 'react';
import { login, register, getCurrentUser, initializeAuth, authStore } from '@stores/auth';

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

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      setSuccess('¡Inicio de sesión exitoso! Redirigiendo...');
      setEmail('');
      setPassword('');
      setIsAuthenticated(true);
      // Redirect after login - usando window.location.replace para forzar recarga completa
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 500);
    } else {
      setError(result.error || 'Error al iniciar sesión');
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
