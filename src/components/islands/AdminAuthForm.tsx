import React, { useState } from 'react';
import { login } from '@stores/auth';
import { supabase } from '@lib/supabase';

export default function AdminAuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // First login with credentials
      const result = await login(email, password);

      if (!result.success) {
        setError(result.error || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      // Then check if user is admin
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('id, role, is_active')
        .eq('email', email)
        .single();

      if (adminError || !adminUser) {
        // Logout the user if not admin
        await supabase.auth.signOut();
        setError('Este usuario no tiene permisos de administrador');
        setLoading(false);
        return;
      }

      if (!adminUser.is_active) {
        await supabase.auth.signOut();
        setError('Esta cuenta de administrador está desactivada');
        setLoading(false);
        return;
      }

      setSuccess('✓ Acceso concedido - Redirigiendo...');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-brand-navy px-6 py-8 text-center">
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              FashionMarket
            </h1>
            <p className="text-brand-gold text-sm">Panel de Administración</p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
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

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy focus:ring-opacity-20"
                  placeholder="admin@fashionmarket.com"
                  required
                />
              </div>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-navy text-white font-semibold rounded hover:bg-brand-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verificando...' : 'Acceder Panel Admin'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 pt-6 border-t border-neutral-200 text-center">
              <p className="text-sm text-neutral-600 mb-2">¿Eres cliente?</p>
              <a
                href="/auth/login"
                className="text-brand-navy font-semibold hover:text-brand-charcoal"
              >
                Volver al login de cliente
              </a>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-white text-xs">
          <p>Acceso restringido</p>
          <p className="mt-1">Solo para administradores autorizados</p>
        </div>
      </div>
    </div>
  );
}
