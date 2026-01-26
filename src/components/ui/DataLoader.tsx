import React, { useState, useEffect, ReactNode } from 'react';
import LoadingSpinner from '@components/ui/LoadingSpinner';

export interface DataLoaderProps {
  onLoad: () => Promise<any>;
  children: (data: any) => ReactNode;
  loadingMessage?: string;
}

export default function DataLoader({ 
  onLoad, 
  children, 
  loadingMessage = 'Cargando datos...' 
}: DataLoaderProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await onLoad();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingSpinner message={loadingMessage} fullScreen={false} />;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-900/30 border border-red-500 text-red-400 rounded">
        <p className="font-bold mb-2">Error al cargar datos</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return <>{children(data)}</>;
}
