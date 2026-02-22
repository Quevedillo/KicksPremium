import { useState, useEffect } from 'react';

interface NewsletterPopupProps {
  delayMs?: number;
  discountPercent?: number;
}

export default function NewsletterPopup({ 
  delayMs = 5000, 
  discountPercent = 10 
}: NewsletterPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [discountCode, setDiscountCode] = useState('');

  useEffect(() => {
    // Verificar si ya se mostró el popup o si el usuario ya está suscrito
    const hasSeenPopup = localStorage.getItem('newsletter_popup_seen');
    const isSubscribed = localStorage.getItem('newsletter_subscribed');
    
    // Verificar si el usuario ya está logueado - no mostrar popup
    const cookies = document.cookie || '';
    const hasAuthCookie = cookies.includes('sb-') && (cookies.includes('access-token') || cookies.includes('auth-token'));
    // También verificar si hay un código de descuento ya usado (usuario reconocido)
    const hasUsedDiscount = localStorage.getItem('discount_code_used') === 'true';
    
    if (!hasSeenPopup && !isSubscribed && !hasAuthCookie && !hasUsedDiscount) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, delayMs);
      
      return () => clearTimeout(timer);
    }
  }, [delayMs]);

  const handleClose = () => {
    setIsOpen(false);
    // Marcar como visto para no mostrar de nuevo en esta sesión
    localStorage.setItem('newsletter_popup_seen', 'true');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;
    
    setStatus('loading');
    
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          source: 'popup',
          generateDiscountCode: true
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus('success');
        setDiscountCode(data.discountCode || 'WELCOME10');
        setMessage('¡Gracias por suscribirte!');
        localStorage.setItem('newsletter_subscribed', 'true');
        localStorage.setItem('newsletter_popup_seen', 'true');
      } else {
        setStatus('error');
        setMessage(data.error || 'Error al suscribirse');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Error de conexión. Inténtalo de nuevo.');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(discountCode);
    setMessage('¡Código copiado!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
          aria-label="Cerrar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-brand-navy to-brand-navy/80 text-white p-8 text-center">
          <div className="text-5xl mb-3"></div>
          <h2 className="text-2xl font-display font-bold mb-2">
            ¡{discountPercent}% DE DESCUENTO!
          </h2>
          <p className="text-white/90 text-sm">
            Suscríbete y recibe tu código exclusivo
          </p>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="text-green-500 text-5xl">✓</div>
              <p className="text-lg font-semibold text-brand-navy">
                ¡Bienvenido a la familia KicksPremium!
              </p>
              <p className="text-neutral-600 text-sm">
                Usa este código en tu primera compra:
              </p>
              <div className="relative">
                <div className="bg-neutral-100 border-2 border-dashed border-brand-navy rounded-lg py-4 px-6">
                  <span className="text-2xl font-mono font-bold text-brand-navy tracking-wider">
                    {discountCode}
                  </span>
                </div>
                <button
                  onClick={copyCode}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-navy hover:text-brand-navy/70 transition-colors"
                  title="Copiar código"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              {message === '¡Código copiado!' && (
                <p className="text-green-600 text-sm">{message}</p>
              )}
              <button
                onClick={handleClose}
                className="w-full bg-brand-navy text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
              >
                Ir a comprar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-neutral-600 text-center text-sm">
                Únete a nuestra newsletter y recibe ofertas exclusivas, 
                novedades y tu código de descuento.
              </p>
              
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-navy focus:border-transparent text-center text-neutral-900 bg-white placeholder-neutral-400"
                  disabled={status === 'loading'}
                />
              </div>

              {status === 'error' && (
                <p className="text-red-500 text-sm text-center">{message}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-brand-navy text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Suscribiendo...
                  </span>
                ) : (
                  `Obtener ${discountPercent}% de descuento`
                )}
              </button>

              <p className="text-xs text-neutral-400 text-center">
                Al suscribirte aceptas recibir emails promocionales. 
                Puedes darte de baja cuando quieras.
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
