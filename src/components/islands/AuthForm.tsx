import React, { useState } from 'react';
import { login, register } from '@stores/auth';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      setSuccess('¡Inicio de sesión exitoso!');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
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
      setSuccess('¡Registro exitoso! Verifica tu email para confirmación.');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } else {
      setError(result.error || 'Error al registrarse');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-brand-navy px-6 py-8 text-center">
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              FashionMarket
            </h1>
            <p className="text-brand-gold text-sm">Moda Masculina Premium</p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {/* Tabs */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 px-4 rounded font-semibold transition-colors ${
                  isLogin
                    ? 'bg-brand-navy text-white'
                    : 'bg-neutral-200 text-brand-navy hover:bg-neutral-300'
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
                className={`flex-1 py-2 px-4 rounded font-semibold transition-colors ${
                  !isLogin
                    ? 'bg-brand-navy text-white'
                    : 'bg-neutral-200 text-brand-navy hover:bg-neutral-300'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                {success}
              </div>
            )}

            {/* Forms */}
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
              {/* Full Name (Register only) */}
              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold text-brand-navy mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy focus:ring-opacity-20"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy focus:ring-opacity-20"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy focus:ring-opacity-20"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-navy text-white font-semibold rounded hover:bg-brand-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Procesando...'
                  : isLogin
                    ? 'Iniciar Sesión'
                    : 'Crear Cuenta'}
              </button>
            </form>

            {/* Admin Link */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <p className="text-center text-sm text-neutral-600 mb-2">
                ¿Eres administrador?
              </p>
              <a
                href="/admin/login"
                className="block w-full py-2 text-center text-brand-navy font-semibold border-2 border-brand-navy rounded hover:bg-brand-navy hover:text-white transition-colors"
              >
                Panel Administrativo
              </a>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-white text-sm">
          <p>Acceso a tu cuenta de cliente</p>
          <p className="mt-2 text-brand-gold">
            ✓ Ver productos sin cuenta
          </p>
          <p className="text-brand-gold">
            ✓ Necesaria para comprar
          </p>
        </div>
      </div>
    </div>
  );
}
