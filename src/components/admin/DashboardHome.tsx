import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users,
  Clock,
  CheckCircle,
  Truck,
  Package,
  RefreshCw,
  AlertCircle,
  Trash2,
  Store,
  StoreIcon,
  Star
} from 'lucide-react';
import * as api from '../../utils/api';
import { useConfig } from '../../ConfigContext';
import { StoreStatusControl } from './StoreStatusControl';
import { ProductPerformance } from './ProductPerformance';
import { useOrdersRealtime } from '../../hooks/useRealtime';

interface Order {
  orderId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: 'pending' | 'preparing' | 'packing' | 'out_for_delivery' | 'ready_for_pickup' | 'completed' | 'cancelled';
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  createdAt: string;
}

interface Stats {
  todaySales: number;
  monthSales: number;
  activeOrders: number;
  totalCustomers: number;
  completedOrders: number;
  topRatedProducts: Array<{ name: string, rating: number, count: number }>;
}

export function DashboardHome() {
  const { config } = useConfig();
  const [stats, setStats] = useState<Stats>({
    todaySales: 0,
    monthSales: 0,
    activeOrders: 0,
    totalCustomers: 0,
    completedOrders: 0,
    topRatedProducts: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isClearing, setIsClearing] = useState(false);

  // Função para buscar estatísticas
  const fetchStats = async () => {
    try {
      console.log('🔄 [DASHBOARD] Carregando dados...');
      setIsLoading(true);

      // 🆕 Usar getFullOrderHistory para incluir pedidos arquivados nas estatísticas
      const response = await api.getFullOrderHistory();
      
      if (response.success && response.orders) {
        console.log('✅ [DASHBOARD] Pedidos carregados (Total):', response.orders.length);
        
        // Calcular estatísticas
        const newStats = calculateStats(response.orders);
        setStats(newStats);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular estatísticas dos pedidos
  const calculateStats = (orders: Order[]): Stats => {
    const now = new Date();
    
    // Função auxiliar para obter o "Dia de Negócio" (reseta às 4h da manhã)
    const getBusinessDate = (date: Date | string) => {
      const d = new Date(date);
      // Subtrair 4 horas para que pedidos entre 00:00 e 03:59 pertençam ao dia anterior
      const businessTime = new Date(d.getTime() - (4 * 60 * 60 * 1000));
      return businessTime.toISOString().split('T')[0];
    };

    const currentBusinessDay = getBusinessDate(now);
    const currentMonth = currentBusinessDay.substring(0, 7); // YYYY-MM

    // Pedidos de hoje (baseado no Dia de Negócio)
    const todayOrders = orders.filter(o => 
      getBusinessDate(o.createdAt) === currentBusinessDay
    );

    // Pedidos do mês (baseado no Dia de Negócio)
    const monthOrders = orders.filter(o => 
      getBusinessDate(o.createdAt).startsWith(currentMonth)
    );

    // Vendas de hoje (Apenas pedidos válidos - não cancelados)
    const todaySales = todayOrders
      .filter(o => o.status !== 'cancelled' && o.status !== 'rejected')
      .reduce((sum, o) => sum + o.total, 0);

    // Vendas do mês (Apenas pedidos válidos)
    const monthSales = monthOrders
      .filter(o => o.status !== 'cancelled' && o.status !== 'rejected')
      .reduce((sum, o) => sum + o.total, 0);

    // Pedidos ativos (não completados e não cancelados)
    const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;

    // Pedidos completados hoje
    const completedOrders = todayOrders.filter(o => o.status === 'completed').length;

    // Total de clientes únicos (por telefone)
    const uniquePhones = new Set(orders.map(o => o.customerPhone));
    const totalCustomers = uniquePhones.size;

    // Calcular Top 3 Avaliados
    const productRatings: { [key: string]: { total: number, count: number } } = {};
    
    orders.forEach((order: any) => {
      if (order.reviews && Array.isArray(order.reviews)) {
        order.reviews.forEach((review: any) => {
          if (!productRatings[review.productName]) {
            productRatings[review.productName] = { total: 0, count: 0 };
          }
          productRatings[review.productName].total += review.rating;
          productRatings[review.productName].count += 1;
        });
      }
    });

    const topRatedProducts = Object.entries(productRatings)
      .map(([name, data]) => ({
        name,
        rating: data.total / data.count,
        count: data.count
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    console.log('📊 [DASHBOARD] Estatísticas calculadas:', {
      todayOrders: todayOrders.length,
      monthOrders: monthOrders.length,
      todaySales,
      monthSales,
      activeOrders,
      totalCustomers,
      topRatedProducts
    });

    return {
      todaySales,
      monthSales,
      activeOrders,
      totalCustomers,
      completedOrders,
      topRatedProducts
    };
  };

  // Carregar dados inicialmente
  useEffect(() => {
    fetchStats();
  }, []);

  // Realtime: substitui o polling fixo de 10s
  // Se Realtime conectar → safety net a cada 15s
  // Se Realtime falhar → fallback a cada 10s
  const { isRealtimeConnected } = useOrdersRealtime(useCallback(() => {
    fetchStats();
  }, []), true);

  // Formatador de tempo relativo
  const getTimeAgo = (date: string): string => {
    const now = new Date();
    const orderDate = new Date(date);
    const diffMs = now.getTime() - orderDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'agora';
    if (diffMins === 1) return '1 min';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours === 1) return '1 hora';
    if (diffHours < 24) return `${diffHours} horas`;
    return orderDate.toLocaleDateString('pt-BR');
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'preparing':
        return { label: 'Preparando', color: 'bg-blue-100 text-blue-800', icon: Clock };
      case 'packing':
        return { label: 'Embalando', color: 'bg-purple-100 text-purple-800', icon: Package };
      case 'out_for_delivery':
        return { label: 'Em Entrega', color: 'bg-orange-100 text-orange-800', icon: Truck };
      case 'ready_for_pickup':
        return { label: 'Pronto', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'completed':
        return { label: 'Concluído', color: 'bg-gray-100 text-gray-800', icon: CheckCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: AlertCircle };
    }
  };

  const formatLastUpdate = (): string => {
    const now = new Date();
    const diff = now.getTime() - lastUpdate.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 5) return 'agora';
    if (seconds < 60) return `${seconds}s atrás`;
    return lastUpdate.toLocaleTimeString('pt-BR');
  };

  const handleClearAllOrders = async () => {
    if (!confirm('⚠️ ATENÇÃO! Isso vai deletar TODOS os pedidos e zerar as estatísticas. Tem certeza?')) {
      return;
    }

    if (!confirm('🔴 CONFIRMAÇÃO FINAL: Todos os pedidos serão DELETADOS PERMANENTEMENTE. Deseja continuar?')) {
      return;
    }

    try {
      setIsClearing(true);
      console.log('🗑️ [DASHBOARD] Limpando todos os pedidos...');
      
      const response = await api.clearAllOrders();
      
      if (response.success) {
        // Limpar localStorage também
        localStorage.removeItem('faroeste_orders');
        
        alert(`✅ ${response.deletedCount || 'Todos os'} pedidos foram deletados com sucesso!`);
        // Recarregar dados imediatamente
        await fetchStats();
      } else {
        // Se falhar no servidor, tentar limpar apenas localStorage
        console.log('⚠️ [DASHBOARD] Servidor offline - limpando apenas localStorage');
        localStorage.removeItem('faroeste_orders');
        alert('✅ Pedidos locais foram deletados com sucesso! (Modo offline)');
        await fetchStats();
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao limpar pedidos:', error);
      
      // Fallback: limpar localStorage mesmo com erro no servidor
      try {
        localStorage.removeItem('faroeste_orders');
        alert('✅ Pedidos locais foram deletados! (Modo offline - servidor indisponível)');
        await fetchStats();
      } catch (localError) {
        alert('❌ Erro ao limpar pedidos. Tente novamente.');
      }
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Visão geral em tempo real do seu negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <p className="hidden sm:block">Última atualização</p>
            <p className="font-medium">{formatLastUpdate()}</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="text-sm text-blue-800 dark:text-blue-300">Atualizando dados em tempo real...</span>
        </div>
      )}

      {/* Store Status Control */}
      <div className="mb-8">
        <StoreStatusControl />
      </div>

      <ProductPerformance />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Vendas Hoje */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Vendas Hoje</p>
              <p className="text-2xl font-bold text-gray-800">
                R$ {stats.todaySales.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.completedOrders} pedido{stats.completedOrders !== 1 ? 's' : ''} concluído{stats.completedOrders !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Vendas do Mês */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Vendas do Mês</p>
              <p className="text-2xl font-bold text-gray-800">
                R$ {stats.monthSales.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Pedidos Ativos */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pedidos Ativos</p>
              <p className="text-2xl font-bold text-gray-800">{stats.activeOrders}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Total de Clientes */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Clientes</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">
                clientes únicos
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <Package className="w-8 h-8 mb-3" />
          <h3 className="font-bold text-lg mb-2">Produtos</h3>
          <p className="text-sm text-green-100 mb-4">
            Gerencie seu cardápio completo
          </p>
          <div className="text-2xl font-bold">
            {/* Pode adicionar contagem de produtos aqui */}
            Ativo
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <ShoppingBag className="w-8 h-8 mb-3" />
          <h3 className="font-bold text-lg mb-2">Pedidos</h3>
          <p className="text-sm text-orange-100 mb-4">
            Acompanhe todos os pedidos
          </p>
          <div className="text-2xl font-bold">
            {stats.activeOrders} ativo{stats.activeOrders !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <Users className="w-8 h-8 mb-3" />
          <h3 className="font-bold text-lg mb-2">Clientes</h3>
          <p className="text-sm text-purple-100 mb-4">
            Base de clientes cadastrados
          </p>
          <div className="text-2xl font-bold">
            {stats.totalCustomers}
          </div>
        </div>
      </div>

      {/* Top 3 Melhores Avaliados */}
      {(config.features?.reviews !== false) && stats.topRatedProducts && stats.topRatedProducts.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            Top 3 Melhores Avaliados
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.topRatedProducts.map((product, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-4 border border-yellow-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                  #{index + 1}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-yellow-100 p-2 rounded-full">
                    <Package className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h4 className="font-bold text-gray-800 line-clamp-1">{product.name}</h4>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-lg text-gray-800">{product.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {product.count} avaliações
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear All Orders Button */}
      <div className="mt-8">
        <button
          onClick={handleClearAllOrders}
          disabled={isClearing}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Trash2 className={`w-5 h-5 ${isClearing ? 'animate-spin' : ''}`} />
          <span>{isClearing ? 'Limpando...' : 'Limpar Todos os Pedidos (Zerar Estatísticas)'}</span>
        </button>
      </div>
    </div>
  );
}