import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  priceFormatted: string;
  brand: string;
  model?: string;
  colorway?: string;
  image: string;
  isLimited: boolean;
  stock: number;
}

interface SearchResponse {
  products: SearchResult[];
  query: string;
  total: number;
}

// Hook personalizado para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function LiveSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounce de 300ms - evita saturar la API
  const debouncedQuery = useDebounce(query, 300);

  // Buscar productos cuando cambia el query (después del debounce)
  useEffect(() => {
    const searchProducts = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/search/products?q=${encodeURIComponent(debouncedQuery)}&limit=8`);
        const data: SearchResponse = await response.json();
        
        setResults(data.products || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Error en búsqueda:', err);
        setError('Error al buscar');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchProducts();
  }, [debouncedQuery]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejar teclas
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Enter' && query.length >= 2) {
      // Ir a página de productos con búsqueda
      window.location.href = `/productos?search=${encodeURIComponent(query)}`;
    }
  }, [query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length >= 2) {
      setIsOpen(true);
    }
  };

  const handleFocus = () => {
    if (query.length >= 2 && results.length > 0) {
      setIsOpen(true);
    }
  };

  const handleResultClick = (slug: string) => {
    setIsOpen(false);
    setQuery('');
    window.location.href = `/productos/${slug}`;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input de búsqueda */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Buscar sneakers..."
          className="w-full md:w-64 lg:w-80 px-4 py-2 pl-10 bg-brand-gray/50 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all text-sm"
          aria-label="Buscar productos"
          autoComplete="off"
        />
        {/* Icono de búsqueda */}
        <svg 
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
        {/* Indicador de carga */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-brand-gray border border-neutral-700 rounded-lg shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {results.length > 0 ? (
            <>
              {/* Lista de resultados */}
              <div className="divide-y divide-neutral-700/50">
                {results.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleResultClick(product.slug)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-brand-dark transition-colors text-left group"
                  >
                    {/* Miniatura */}
                    <div className="w-14 h-14 bg-brand-dark rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        loading="lazy"
                      />
                      {product.isLimited && (
                        <div className="absolute top-0 right-0 bg-brand-red text-white text-[8px] font-bold px-1 rounded-bl">
                          LTD
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-brand-red text-xs font-bold uppercase tracking-wider">
                        {product.brand}
                      </div>
                      <div className="text-white font-semibold text-sm truncate group-hover:text-brand-red transition-colors">
                        {product.name}
                      </div>
                      {product.colorway && (
                        <div className="text-neutral-500 text-xs truncate">
                          {product.colorway}
                        </div>
                      )}
                    </div>
                    {/* Precio */}
                    <div className="text-white font-bold text-sm">
                      {product.priceFormatted}
                    </div>
                  </button>
                ))}
              </div>
              {/* Ver todos los resultados */}
              <a 
                href={`/productos?search=${encodeURIComponent(query)}`}
                className="block p-3 text-center text-brand-red hover:bg-brand-dark transition-colors text-sm font-bold border-t border-neutral-700"
              >
                Ver todos los resultados →
              </a>
            </>
          ) : (
            /* No hay resultados */
            <div className="p-6 text-center">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-neutral-400 text-sm">
                No se encontraron resultados para "<span className="text-white">{query}</span>"
              </p>
              <p className="text-neutral-500 text-xs mt-1">
                Intenta con otro término de búsqueda
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
