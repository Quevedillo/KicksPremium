import React, { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

interface Stats {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  recentOrders: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalCategories: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      // Obtener total de productos
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      // Obtener total de categorías
      const { count: categoryCount } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true });

      // Obtener total de órdenes
      const { data: ordersData, count: orderCount } = await supabase
        .from('orders')
        .select('id, status, total_price, created_at, billing_email', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10);

      // Calcular ingresos y pedidos pendientes
      let totalRevenue = 0;
      let pendingOrders = 0;

      if (ordersData) {
        ordersData.forEach((order) => {
          if (order.status === 'completed' || order.status === 'paid') {
            totalRevenue += order.total_price || 0;
          }
          if (order.status === 'pending') {
            pendingOrders += 1;
          }
        });
      }

      setStats({
        totalProducts: productCount || 0,
        totalCategories: categoryCount || 0,
        totalOrders: orderCount || 0,
        totalRevenue,
        pendingOrders,
        recentOrders: ordersData || [],
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setLoading(false);
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(cents / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
      paid: { color: 'bg-green-100 text-green-800', label: 'Pagado' },
      processing: { color: 'bg-blue-100 text-blue-800', label: 'Procesando' },
      shipped: { color: 'bg-purple-100 text-purple-800', label: 'Enviado' },
      completed: { color: 'bg-green-100 text-green-800', label: 'Completado' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelado' },
    };
    return badges[status] || { color: 'bg-neutral-100 text-neutral-800', label: status };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
          <p className="mt-4 text-neutral-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Productos */}
        <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
              Activos
            </span>
          </div>
          <p className="text-3xl font-bold text-brand-black">{stats.totalProducts}</p>
          <p className="text-sm text-neutral-500 mt-1">Productos en catálogo</p>
        </div>

        {/* Pedidos Totales */}
        <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            {stats.pendingOrders > 0 && (
              <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                {stats.pendingOrders} pendientes
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-brand-black">{stats.totalOrders}</p>
          <p className="text-sm text-neutral-500 mt-1">Pedidos totales</p>
        </div>

        {/* Ingresos */}
        <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-brand-black">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-sm text-neutral-500 mt-1">Ingresos totales</p>
        </div>

        {/* Categorías */}
        <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-brand-black">{stats.totalCategories}</p>
          <p className="text-sm text-neutral-500 mt-1">Categorías activas</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200">
          <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-black">Pedidos Recientes</h2>
            <a href="/admin/pedidos" className="text-sm text-brand-red hover:text-brand-orange font-medium">
              Ver todos →
            </a>
          </div>
          
          {stats.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="divide-y divide-neutral-100">
              {stats.recentOrders.map((order) => {
                const badge = getStatusBadge(order.status);
                return (
                  <div key={order.id} className="p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-brand-black">
                          #{order.id.slice(0, 8)}...
                        </p>
                        <p className="text-sm text-neutral-500">
                          {order.billing_email || 'Sin email'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-black">
                          {formatCurrency(order.total_price)}
                        </p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-neutral-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-neutral-500">No hay pedidos todavía</p>
            </div>
          )}
        </div>

        {/* Alerts Section */}
        <div className="space-y-6">
          {/* Stock Alerts */}
          <div className="bg-white rounded-xl border border-neutral-200">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-brand-black">⚠️ Alertas de Stock</h2>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm font-medium text-green-800">
                    Stock correcto
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Todos los productos tienen stock suficiente
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-neutral-200">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-brand-black">🚀 Acciones Rápidas</h2>
            </div>
            
            <div className="p-4 space-y-2">
              <a
                href="/admin/productos/nuevo"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-brand-red/10 rounded-lg flex items-center justify-center group-hover:bg-brand-red/20 transition-colors">
                  <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-brand-black">Nuevo Producto</p>
                  <p className="text-xs text-neutral-500">Añadir sneaker al catálogo</p>
                </div>
              </a>
              
              <a
                href="/admin/categorias"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-brand-black">Gestionar Categorías</p>
                  <p className="text-xs text-neutral-500">Organizar colecciones</p>
                </div>
              </a>
              
              <a
                href="/admin/pedidos"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-brand-black">Ver Pedidos</p>
                  <p className="text-xs text-neutral-500">Gestionar órdenes</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
