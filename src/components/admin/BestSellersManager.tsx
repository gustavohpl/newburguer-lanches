import React, { useEffect, useState } from 'react';
import { TrendingUp, Eye, EyeOff, Package, RefreshCw } from 'lucide-react';
import { useConfig } from '../../ConfigContext';
import * as api from '../../utils/api';
import { adminFetch } from '../../utils/api';

interface BestSellerItem {
  productId: string;
  productName: string;
  imageUrl?: string;
  orderCount: number;
  isHidden: boolean;
  isAvailable: boolean;
}

export function BestSellersManager() {
  const { config, refreshConfig } = useConfig();
  const themeColor = config.themeColor || '#d97706';
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar pedidos
      const ordersRes = await api.getAllOrders();
      // Buscar produtos
      const productsRes = await api.getAllProducts();

      if (ordersRes.success && ordersRes.orders) {
        setTotalOrders(ordersRes.orders.length);
        
        // Contar pedidos por produto
        const productCounts: Record<string, number> = {};
        ordersRes.orders.forEach((order: any) => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              const productId = item.productId || item.id;
              if (productId) {
                productCounts[productId] = (productCounts[productId] || 0) + (item.quantity || 1);
              }
            });
          }
        });

        const hiddenIds = config.hiddenBestSellers || [];
        const products = productsRes.success ? (productsRes.products || []) : [];

        // Criar lista ordenada
        const items: BestSellerItem[] = Object.entries(productCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([id, count]) => {
            const product = products.find((p: any) => p.id === id);
            return {
              productId: id,
              productName: product?.name || `Produto #${id.slice(0, 6)}`,
              imageUrl: product?.imageUrl || product?.image,
              orderCount: count,
              isHidden: hiddenIds.includes(id),
              isAvailable: product ? product.available !== false : false,
            };
          });

        setBestSellers(items);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleProduct = async (productId: string) => {
    setSaving(true);
    try {
      const hiddenIds = [...(config.hiddenBestSellers || [])];
      const index = hiddenIds.indexOf(productId);
      
      if (index >= 0) {
        hiddenIds.splice(index, 1); // Mostrar
      } else {
        hiddenIds.push(productId); // Ocultar
      }

      // Salvar no config via admin API
      await adminFetch('/admin/config', {
        method: 'POST',
        body: JSON.stringify({ hiddenBestSellers: hiddenIds }),
      });
      await refreshConfig();

      // Atualizar estado local
      setBestSellers(prev => prev.map(item => 
        item.productId === productId 
          ? { ...item, isHidden: !item.isHidden }
          : item
      ));
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = bestSellers.filter(b => !b.isHidden && b.isAvailable).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl text-white" style={{ backgroundColor: themeColor }}>
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Mais Pedidos</h2>
            <p className="text-sm text-gray-500">
              {totalOrders} pedidos realizados • {visibleCount} produtos visíveis
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700">
          <strong>ℹ️ Como funciona:</strong> Esta lista é calculada automaticamente com base nos pedidos reais dos clientes. 
          Produtos indisponíveis não aparecem no site. Use o botão de olho para ocultar produtos específicos da seção "Mais Pedidos" no site.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Calculando mais pedidos...</p>
        </div>
      ) : bestSellers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum pedido realizado ainda</p>
          <p className="text-sm text-gray-400 mt-1">Quando clientes fizerem pedidos, os produtos mais populares aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bestSellers.map((item, index) => (
            <div 
              key={item.productId} 
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                item.isHidden 
                  ? 'bg-gray-50 border-gray-200 opacity-60' 
                  : !item.isAvailable
                    ? 'bg-red-50 border-red-200 opacity-70'
                    : 'bg-white border-gray-200 hover:shadow-md'
              }`}
            >
              {/* Ranking */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                style={{ backgroundColor: index < 3 ? themeColor : '#9ca3af' }}
              >
                {index + 1}
              </div>

              {/* Imagem */}
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.productName}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-gray-400" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${item.isHidden ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {item.productName}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {item.orderCount} pedido{item.orderCount !== 1 ? 's' : ''}
                  </span>
                  {!item.isAvailable && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                      Indisponível
                    </span>
                  )}
                  {item.isHidden && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                      Oculto
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle visibilidade */}
              <button
                onClick={() => toggleProduct(item.productId)}
                disabled={saving}
                className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                  item.isHidden 
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-500' 
                    : 'text-white hover:opacity-80'
                }`}
                style={!item.isHidden ? { backgroundColor: themeColor } : undefined}
                title={item.isHidden ? 'Mostrar no site' : 'Ocultar do site'}
              >
                {item.isHidden ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
