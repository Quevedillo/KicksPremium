import React, { useState } from 'react';

interface SizeRecommenderProps {
  availableSizes: string[];
}

// Tabla de conversión: longitud del pie en cm -> talla EU
const sizeChart = [
  { cm: 22.0, eu: '35.5' },
  { cm: 22.5, eu: '36' },
  { cm: 23.0, eu: '36.5' },
  { cm: 23.5, eu: '37.5' },
  { cm: 24.0, eu: '38' },
  { cm: 24.5, eu: '38.5' },
  { cm: 25.0, eu: '39' },
  { cm: 25.5, eu: '40' },
  { cm: 26.0, eu: '40.5' },
  { cm: 26.5, eu: '41' },
  { cm: 27.0, eu: '42' },
  { cm: 27.5, eu: '42.5' },
  { cm: 28.0, eu: '43' },
  { cm: 28.5, eu: '44' },
  { cm: 29.0, eu: '44.5' },
  { cm: 29.5, eu: '45' },
  { cm: 30.0, eu: '45.5' },
  { cm: 30.5, eu: '46' },
  { cm: 31.0, eu: '47' },
  { cm: 31.5, eu: '47.5' },
  { cm: 32.0, eu: '48' },
];

function recommendSize(footLengthCm: number, footWidthCm: number | null): { recommended: string; alt: string | null; note: string } {
  // Encontrar talla basada en longitud
  let match = sizeChart.find(s => s.cm >= footLengthCm);
  if (!match) {
    match = sizeChart[sizeChart.length - 1];
  }

  let note = '';
  let alt: string | null = null;

  // Si el pie es ancho (>10.5cm), recomendar subir media talla
  if (footWidthCm && footWidthCm > 10.5) {
    const idx = sizeChart.findIndex(s => s.eu === match!.eu);
    if (idx < sizeChart.length - 1) {
      alt = match.eu;
      match = sizeChart[idx + 1];
      note = 'Tu pie es algo ancho, te recomendamos media talla más para mayor comodidad.';
    }
  } else if (footWidthCm && footWidthCm < 8.5) {
    note = 'Tu pie es estrecho, la talla recomendada debería ajustar bien.';
  }

  if (!note) {
    note = 'Basado en tus medidas, esta es la talla que mejor te queda.';
  }

  return { recommended: match.eu, alt, note };
}

export default function SizeRecommender({ availableSizes }: SizeRecommenderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [footLength, setFootLength] = useState('');
  const [footWidth, setFootWidth] = useState('');
  const [result, setResult] = useState<{ recommended: string; alt: string | null; note: string; available: boolean } | null>(null);

  const handleRecommend = () => {
    const length = parseFloat(footLength);
    if (isNaN(length) || length < 20 || length > 35) {
      return;
    }

    const width = footWidth ? parseFloat(footWidth) : null;
    const rec = recommendSize(length, width);
    const available = availableSizes.includes(rec.recommended);

    setResult({ ...rec, available });
  };

  const handleReset = () => {
    setFootLength('');
    setFootWidth('');
    setResult(null);
  };

  return (
    <div className="border border-neutral-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-gray hover:bg-brand-gray/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📏</span>
          <span className="text-white font-bold text-sm uppercase tracking-wider">
            ¿No sabes tu talla? Mide tu pie
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-5 bg-brand-dark/50 border-t border-neutral-700 space-y-4">
          <p className="text-neutral-400 text-xs">
            Introduce la longitud de tu pie en centímetros (desde el talón hasta el dedo más largo) y opcionalmente el ancho para una recomendación más precisa.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-semibold uppercase">
                Longitud del pie (cm) *
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="35"
                value={footLength}
                onChange={(e) => { setFootLength(e.target.value); setResult(null); }}
                placeholder="Ej: 27.5"
                className="w-full bg-brand-gray border border-neutral-700 text-white px-3 py-2.5 text-sm rounded focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-semibold uppercase">
                Ancho del pie (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="6"
                max="15"
                value={footWidth}
                onChange={(e) => { setFootWidth(e.target.value); setResult(null); }}
                placeholder="Ej: 10.0"
                className="w-full bg-brand-gray border border-neutral-700 text-white px-3 py-2.5 text-sm rounded focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRecommend}
              disabled={!footLength || parseFloat(footLength) < 20 || parseFloat(footLength) > 35}
              className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wider rounded transition-colors ${
                footLength && parseFloat(footLength) >= 20 && parseFloat(footLength) <= 35
                  ? 'bg-brand-red text-white hover:bg-brand-orange'
                  : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
              }`}
            >
              Recomendar talla
            </button>
            {result && (
              <button
                onClick={handleReset}
                className="px-4 py-2.5 text-sm font-bold text-neutral-400 hover:text-white border border-neutral-700 rounded transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          {result && (
            <div className={`rounded-lg p-4 ${result.available ? 'bg-green-900/30 border border-green-700/50' : 'bg-yellow-900/30 border border-yellow-700/50'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{result.available ? '✅' : '⚠️'}</span>
                <div>
                  <p className="text-white font-bold text-lg">
                    Talla recomendada: <span className="text-brand-red">{result.recommended} EU</span>
                  </p>
                  {result.alt && (
                    <p className="text-neutral-400 text-xs">
                      Talla base: {result.alt} EU (ajustada por ancho del pie)
                    </p>
                  )}
                </div>
              </div>
              <p className="text-neutral-300 text-sm">{result.note}</p>
              {!result.available && (
                <p className="text-yellow-400 text-sm mt-2 font-semibold">
                  ⚠️ Esta talla no está disponible actualmente para este producto. Revisa las tallas disponibles arriba.
                </p>
              )}
              {result.available && (
                <p className="text-green-400 text-sm mt-2 font-semibold">
                  ✓ Esta talla está disponible. ¡Selecciónala arriba!
                </p>
              )}
            </div>
          )}

          <a href="/servicios/guia-tallas" className="inline-block text-brand-red text-xs font-semibold hover:text-brand-orange transition-colors">
            Ver guía completa de tallas →
          </a>
        </div>
      )}
    </div>
  );
}
