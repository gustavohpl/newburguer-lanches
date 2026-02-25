import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader, Package, AlertCircle } from 'lucide-react';
import * as api from '../../utils/api';

interface ProductStats {
  id: string;
  name: string;
  count: number;
  revenue: number;
  imageUrl?: string;
}

export function ProductPerformance() {
  const [topProducts, setTopProducts] = useState<ProductStats[]>([]);
  const [bottomProducts, setBottomProducts] = useState<ProductStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // 🆕 Usar getFullOrderHistory para incluir histórico completo
      const response = await api.getFullOrderHistory();
      
      if (response.success && response.orders && response.orders.length > 0) {
        processOrders(response.orders);
        setHasData(true);
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('Erro ao carregar performance de produtos:', error);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  };

  const processOrders = (orders: any[]) => {
    const productMap = new Map<string, ProductStats>();

    // Filtrar apenas pedidos válidos (não cancelados)
    const validOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'rejected');

    validOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          // Usar ID se disponível, senão usar nome como chave
          const key = item.id || item.name;
          
          if (!productMap.has(key)) {
            productMap.set(key, {
              id: item.id,
              name: item.name,
              count: 0,
              revenue: 0,
              imageUrl: item.imageUrl
            });
          }

          const stats = productMap.get(key)!;
          stats.count += item.quantity || 1;
          stats.revenue += (item.price || 0) * (item.quantity || 1);
        });
      }
    });

    const allProducts = Array.from(productMap.values());
    
    // Sort by count descending
    allProducts.sort((a, b) => b.count - a.count);

    // Top 5
    setTopProducts(allProducts.slice(0, 5));

    // Bottom 5 (reverse of top, but filtered to show actual low performers)
    // Se tiver menos de 5 produtos, bottom será vazio ou duplicado, então tratamos isso
    if (allProducts.length > 5) {
      // Pegar os últimos 5
      setBottomProducts([...allProducts].reverse().slice(0, 5));
    } else {
      setBottomProducts([]); // Não faz sentido mostrar "menos vendidos" se só tem 3 produtos
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md mt-6">
        <Loader className="w-6 h-6 text-amber-600 animate-spin mr-2" />
        <span className="text-gray-600">Calculando performance...</span>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Placeholder Mais Pedidos */}
        <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-gray-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Produtos Mais Pedidos</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Package className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Ainda não há dados suficientes para análise.</p>
            <p className="text-xs text-gray-400 mt-1">Realize vendas para ver as estatísticas.</p>
          </div>
        </div>

        {/* Placeholder Menos Pedidos */}
        <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-gray-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Produtos Menos Pedidos</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Package className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Ainda não há dados suficientes para análise.</p>
            <p className="text-xs text-gray-400 mt-1">Realize vendas para ver as estatísticas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Mais Pedidos */}
      <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-green-500">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Produtos Mais Pedidos</h3>
        </div>

        <div className="space-y-4">
          {topProducts.map((product, index) => (
            <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-500">R$ {product.revenue.toFixed(2)} receita</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                  {product.count}x
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Menos Pedidos */}
      <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-red-500">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-red-100 rounded-lg">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Produtos Menos Pedidos</h3>
        </div>

        {bottomProducts.length > 0 ? (
          <div className="space-y-4">
            {bottomProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Package className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500">R$ {product.revenue.toFixed(2)} receita</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                    {product.count}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-center">
            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
            <p>Dados insuficientes para análise de baixa performance</p>
          </div>
        )}
      </div>
    </div>
  );
}
