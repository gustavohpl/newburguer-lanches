import React, { useState, useEffect, useCallback } from 'react';
import { Truck, MapPin, Clock, Package, ChevronDown, ChevronUp, User, Phone, Navigation, AlertCircle, CheckCircle, RefreshCw, Settings, Save, X } from 'lucide-react';
import * as api from '../../utils/api';
import { useOrdersRealtime } from '../../hooks/useRealtime';

interface Order {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  deliverySector?: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  estimatedTime?: number | { min: number; max: number };
  driver?: { name: string; phone: string; color?: string };
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface Driver {
  name: string;
  phone: string;
  color: string;
  lastLogin: string;
  status: string;
  computedStats?: { today: number; month: number; total: number };
}

export function DeliveryArea() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]); // Novo estado para pedidos concluídos
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [deliveryConfig, setDeliveryConfig] = useState({ maxDrivers: 5, activeColors: [] as string[] });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'ready' | 'inRoute' | 'completed' | 'drivers'>('ready');
  const [stats, setStats] = useState({
    readyForDelivery: 0,
    outForDelivery: 0,
    completedToday: 0
  });

  useEffect(() => {
    loadData();
    loadConfig(); // Load config once on mount
  }, []);

  // Realtime: substitui o polling fixo de 1s
  // Se Realtime conectar → safety net a cada 10s (delivery precisa ser responsivo)
  // Se Realtime falhar → fallback a cada 5s
  const { isRealtimeConnected: isDeliveryAreaRealtime } = useOrdersRealtime(useCallback(() => {
    console.log('🔄 [DELIVERY AREA] Refresh via Realtime/polling');
    loadData();
  }, []), true);

  const loadConfig = async () => {
    try {
        const configResponse = await api.getDeliveryConfig();
        if (configResponse && (configResponse.maxDrivers !== undefined || configResponse.activeColors)) {
            setDeliveryConfig({
                maxDrivers: configResponse.maxDrivers || 5,
                activeColors: configResponse.activeColors || []
            });
        }
    } catch (e) {
        console.error('Error loading config', e);
    }
  };

  const loadData = async () => {
    try {
      console.log('📦 [DELIVERY AREA] Carregando dados...');
      
      // Carregar pedidos, setores E drivers em paralelo
      const [ordersResponse, sectorsResponse, driversResponse, historyResponse] = await Promise.all([
        api.getAllOrders(),
        api.getDeliverySectors(),
        api.getDeliveryDrivers(),
        api.getOrderHistory() // Buscar histórico para aba de concluídos
      ]);

      if (ordersResponse.success && ordersResponse.orders) {
        // Filtrar apenas pedidos de delivery
        const deliveryOrders = ordersResponse.orders.filter(
          (o: Order) => o.deliveryType === 'delivery'
        );
        
        setOrders(deliveryOrders);
        
        // Calcular estatísticas dos pedidos ATIVOS
        const ready = deliveryOrders.filter((o: Order) => o.status === 'ready_for_delivery').length;
        const outFor = deliveryOrders.filter((o: Order) => o.status === 'out_for_delivery').length;
        
        console.log('✅ [DELIVERY AREA] Pedidos ativos carregados:', deliveryOrders.length);
        console.log('📊 [DELIVERY AREA] Pedidos ativos - Prontos:', ready, '| Em Rota:', outFor);
        
        // Processar histórico e calcular "Entregues Hoje"
        if (historyResponse.success && historyResponse.orders) {
          const deliveryHistory = historyResponse.orders.filter(
            (o: Order) => o.deliveryType === 'delivery' && o.status === 'completed'
          );
          
          setCompletedOrders(deliveryHistory);
          
          // Contar pedidos concluídos HOJE (considerando Dia de Negócio: reseta às 4h da manhã)
          const getBusinessDate = (date: Date | string) => {
            const d = new Date(date);
            const businessTime = new Date(d.getTime() - (4 * 60 * 60 * 1000));
            return businessTime.toDateString();
          };

          const todayBusinessDay = getBusinessDate(new Date());
          
          const completedToday = deliveryHistory.filter((o: Order) => {
            const completionDate = (o as any).completedAt || (o as any).updatedAt || o.createdAt;
            const isToday = todayBusinessDay === getBusinessDate(completionDate);
            
            if (isToday) {
              console.log('✅ [DELIVERY AREA] Pedido completado no dia de negócio atual:', o.orderId, completionDate);
            }
            
            return isToday;
          }).length;
          
          // Atualizar todas as estatísticas de uma vez
          setStats({
            readyForDelivery: ready,
            outForDelivery: outFor,
            completedToday
          });
          
          console.log('✅ [DELIVERY AREA] Histórico carregado:', deliveryHistory.length);
          console.log('📊 [DELIVERY AREA] Stats finais:', { ready, outFor, completedToday });
        }
      }

      if (sectorsResponse.success && sectorsResponse.sectors) {
        setSectors(sectorsResponse.sectors);
        console.log('✅ [DELIVERY AREA] Setores carregados:', sectorsResponse.sectors.length);
      }

      if (driversResponse.success && driversResponse.drivers) {
        // Filtrar apenas drivers online do dia COM TIMEOUT
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        const TIMEOUT_HOURS = 9; // Considerar offline após 9 horas sem atividade
        
        console.log('🚗 [DELIVERY AREA] Total de drivers recebidos:', driversResponse.drivers.length);
        console.log('🚗 [DELIVERY AREA] Drivers recebidos:', JSON.stringify(driversResponse.drivers, null, 2));
        
        const activeDrivers = driversResponse.drivers.filter((d: Driver) => {
          if (!d.lastLogin) {
            console.log(`❌ [DELIVERY AREA] Driver ${d.name} sem lastLogin`);
            return false;
          }
          
          const loginDate = d.lastLogin.split('T')[0];
          const isToday = loginDate === todayStr;
          
          // Verificar timeout: se o último login foi há mais de 9 horas, considerar offline
          const lastLoginTime = new Date(d.lastLogin);
          const hoursSinceLogin = (now.getTime() - lastLoginTime.getTime()) / (1000 * 60 * 60);
          const isWithinTimeout = hoursSinceLogin < TIMEOUT_HOURS;
          
          // Só considerar ativo se: login foi hoje + status é online + dentro do timeout
          const isActive = isToday && d.status === 'online' && isWithinTimeout;
          
          console.log(`🔍 [DELIVERY AREA] Driver ${d.name}:`, {
            isToday,
            status: d.status,
            hoursSinceLogin: hoursSinceLogin.toFixed(1),
            isWithinTimeout,
            isActive,
            computedStats: d.computedStats
          });
          
          if (!isActive && d.status === 'online') {
            console.log(`⏰ [DELIVERY AREA] Driver ${d.name} considerado offline por timeout (${hoursSinceLogin.toFixed(1)}h desde login)`);
          }
          
          return isActive;
        });
        
        setDrivers(activeDrivers);
        console.log('✅ [DELIVERY AREA] Entregadores ativos finais:', activeDrivers.length);
        console.log('✅ [DELIVERY AREA] Detalhes dos entregadores ativos:', JSON.stringify(activeDrivers, null, 2));
      }
    } catch (error) {
      console.error('❌ [DELIVERY AREA] Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSector = (sectorId: string) => {
    setExpandedSectors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectorId)) {
        newSet.delete(sectorId);
      } else {
        newSet.add(sectorId);
      }
      return newSet;
    });
  };

  const getOrdersBySector = (sectorId: string) => {
    return orders.filter(
      o => o.deliverySector === sectorId && o.status === 'ready_for_delivery'
    );
  };

  const getSectorColor = (sectorId: string) => {
    const sector = sectors.find(s => s.id === sectorId);
    return sector?.color || '#6B7280';
  };

  const getSectorName = (sectorId: string) => {
    const sector = sectors.find(s => s.id === sectorId);
    return sector?.name || 'Setor desconhecido';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeSinceReady = (dateString: string) => {
    const now = new Date();
    const orderDate = new Date(dateString);
    const diff = Math.floor((now.getTime() - orderDate.getTime()) / 1000 / 60); // minutos
    
    if (diff < 5) return { text: 'Acabou de ficar pronto', color: 'text-green-600' };
    if (diff < 10) return { text: `${diff} min atrás`, color: 'text-green-600' };
    if (diff < 20) return { text: `${diff} min atrás`, color: 'text-yellow-600' };
    return { text: `${diff} min atrás`, color: 'text-red-600 font-bold' };
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      console.log('🔄 [DELIVERY AREA] Atualizando status:', { orderId, newStatus });
      
      const response = await api.updateOrderStatus(orderId, newStatus);
      
      if (response.success) {
        console.log('✅ [DELIVERY AREA] Status atualizado');
        await loadData(); // Recarregar dados
      } else {
        console.error('❌ [DELIVERY AREA] Erro ao atualizar:', response.error);
        alert('Erro ao atualizar status do pedido');
      }
    } catch (error) {
      console.error('❌ [DELIVERY AREA] Erro:', error);
      alert('Erro ao atualizar status do pedido');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setIsSavingConfig(true);
      // Se tiver cores selecionadas, o limite é o número de cores
      // Se não tiver, o limite é 0 (fechado) ou o que for definido.
      // Com a nova UI, activeColors define tudo.
      
      const configToSave = {
        activeColors: deliveryConfig.activeColors,
        maxDrivers: deliveryConfig.activeColors.length
      };
      
      const response = await api.saveDeliveryConfig(configToSave);
      
      if (response.success) {
        alert('✅ Configuração de entregadores salva!');
        setShowConfigModal(false);
      } else {
        alert('❌ Erro ao salvar config: ' + (response.error || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar configuração');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleForceLogout = async (driver: Driver) => {
    if (!confirm(`Forçar logout do entregador "${driver.name}"?\n\nIsso irá desconectá-lo e liberar a cor para outro entregador.`)) {
      return;
    }

    try {
      console.log('🚨 [DELIVERY AREA] Forçando logout:', driver.phone);
      const response = await api.forceDriverLogout(driver.phone);
      
      if (response.success) {
        alert(`✅ Entregador "${driver.name}" desconectado com sucesso!`);
        await loadData(); // Recarregar lista
      } else {
        alert('❌ Erro ao desconectar entregador: ' + (response.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('❌ [DELIVERY AREA] Erro ao forçar logout:', error);
      alert('Erro ao desconectar entregador');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">Carregando área de entregas...</span>
      </div>
    );
  }

  // Agrupar setores com pedidos prontos
  const sectorsWithOrders = sectors.filter(sector => {
    const ordersInSector = getOrdersBySector(sector.id);
    return ordersInSector.length > 0;
  });

  // Pedidos sem setor definido
  const ordersWithoutSector = orders.filter(
    o => !o.deliverySector && o.status === 'ready_for_delivery'
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Área de Entregas</h1>
              <p className="text-sm text-gray-600">Gerencie pedidos prontos para entrega por setor</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                  loadConfig(); // Refresh config when opening modal
                  setShowConfigModal(true);
              }}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Settings className="w-4 h-4" />
              Configurar Entregadores
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-800">{stats.readyForDelivery}</p>
                <p className="text-sm text-orange-700">Prontos para Entrega</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Navigation className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-800">{stats.outForDelivery}</p>
                <p className="text-sm text-blue-700">Saíram para Entrega</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-800">{stats.completedToday}</p>
                <p className="text-sm text-green-700">Entregues Hoje</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {stats.readyForDelivery > 5 && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-bold text-red-800">⚠️ Muitos pedidos acumulando!</p>
              <p className="text-sm text-red-700">
                {stats.readyForDelivery} pedidos aguardando entrega. Considere chamar mais entregadores.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mb-6 bg-white rounded-lg border-2 border-gray-200 p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('ready')}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'ready'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Package className="w-5 h-5" />
            <span>Prontos ({stats.readyForDelivery})</span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('inRoute')}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'inRoute'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Navigation className="w-5 h-5" />
            <span>Em Rota ({stats.outForDelivery})</span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'completed'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Concluídos ({stats.completedToday})</span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('drivers')}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'drivers'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Truck className="w-5 h-5" />
            <span>Entregadores ({drivers.length})</span>
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'ready' && (
        <div className="space-y-4">
          {/* Pedidos Sem Setor */}
          {ordersWithoutSector.length > 0 && (
            <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-700" />
                <h3 className="font-bold text-yellow-800">Pedidos sem setor definido</h3>
                <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">
                  {ordersWithoutSector.length}
                </span>
              </div>
              
              <div className="space-y-2">
                {ordersWithoutSector.map(order => (
                  <div key={order.orderId} className="bg-white rounded-lg p-3 border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">#{order.orderId}</span>
                          <span className="text-sm text-gray-600">{order.customerName}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{order.address || 'Endereço não informado'}</p>
                      </div>
                      
                      <button
                        onClick={() => updateOrderStatus(order.orderId, 'out_for_delivery')}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Marcar como Saiu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Setores */}
          <div className="space-y-4">
            {sectorsWithOrders.length === 0 && ordersWithoutSector.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Nenhum pedido pronto para entrega</p>
                <p className="text-sm text-gray-500 mt-1">Os pedidos aparecerão aqui quando estiverem prontos</p>
              </div>
            ) : (
              sectorsWithOrders.map(sector => {
                const ordersInSector = getOrdersBySector(sector.id);
                const isExpanded = expandedSectors.has(sector.id);
                
                return (
                  <div key={sector.id} className="bg-white rounded-lg border-2 shadow-sm overflow-hidden">
                    {/* Header do Setor */}
                    <div
                      className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                      style={{ borderLeftWidth: '6px', borderLeftColor: sector.color }}
                      onClick={() => toggleSector(sector.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: sector.color }}
                        >
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            {sector.name}
                            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {ordersInSector.length}
                            </span>
                          </h3>
                          <p className="text-sm text-gray-600">
                            {ordersInSector.length} {ordersInSector.length === 1 ? 'pedido pronto' : 'pedidos prontos'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                         {/* Status do Grupo */}
                         {ordersInSector.length > 0 && (
                           <div className="flex flex-col items-end">
                             <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full animate-pulse">
                               Aguardando Retirada
                             </span>
                           </div>
                         )}

                         {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                      </div>
                    </div>

                    {/* Pedidos do Setor (Expandido) */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50">
                        <div className="p-4 space-y-3">
                          {ordersInSector.map(order => {
                            const timeInfo = getTimeSinceReady(order.createdAt);
                            
                            return (
                              <div 
                                key={order.orderId} 
                                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                              >
                                {/* Header do Pedido */}
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-bold text-lg text-gray-800">#{order.orderId}</span>
                                      <span className={`text-xs font-medium ${timeInfo.color}`}>
                                        {timeInfo.text}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <User className="w-4 h-4" />
                                      <span className="font-medium">{order.customerName}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                      <Phone className="w-4 h-4" />
                                      <span>{order.customerPhone}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-gray-800">
                                      R$ {order.total.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {formatTime(order.createdAt)}
                                    </div>
                                  </div>
                                </div>

                                {/* Endereço */}
                                <div className="bg-gray-50 rounded p-2 mb-3">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                                    <p className="text-sm text-gray-700">{order.address || 'Endereço não informado'}</p>
                                  </div>
                                </div>

                                {/* Itens do Pedido */}
                                <div className="mb-3">
                                  <p className="text-xs font-bold text-gray-600 mb-1">ITENS:</p>
                                  <div className="space-y-1">
                                    {order.items.map((item, idx) => (
                                      <div key={idx} className="text-sm text-gray-700 flex justify-between">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Botão de Ação (Individual removido em favor do grupo, mas mantido como fallback ou visualização) */}
                                {/* 
                                <button
                                  onClick={() => updateOrderStatus(order.orderId, 'out_for_delivery')}
                                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                  <Truck className="w-4 h-4" />
                                  Marcar como "Saiu para Entrega"
                                </button>
                                */}
                                <div className="mt-2 text-center text-xs text-gray-500 italic bg-gray-50 p-2 rounded flex items-center justify-center gap-2">
                                    <Clock className="w-3 h-3" />
                                    Aguardando entregador iniciar rota
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'inRoute' && (
        <div className="space-y-4">
          {/* 🎨 NOVA VISUALIZAÇÃO: Cestinhas por Cor do Entregador */}
          {orders.filter(o => o.status === 'out_for_delivery').length > 0 ? (
            (() => {
              // Agrupar pedidos por cor do entregador
              const ordersByDriverColor: Record<string, { driver: { name: string; phone: string; color: string }, orders: Order[], sectors: Set<string> }> = {};
              
              orders.filter(o => o.status === 'out_for_delivery').forEach(order => {
                if (order.driver && order.driver.color) {
                  const color = order.driver.color;
                  
                  if (!ordersByDriverColor[color]) {
                    ordersByDriverColor[color] = {
                      driver: order.driver,
                      orders: [],
                      sectors: new Set()
                    };
                  }
                  
                  ordersByDriverColor[color].orders.push(order);
                  
                  // Adicionar setor à lista
                  if (order.deliverySector) {
                    ordersByDriverColor[color].sectors.add(order.deliverySector);
                  }
                }
              });
              
              return (
                <div className="space-y-4">
                  {/* Título e instrução */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Navigation className="w-5 h-5 text-blue-700" />
                      <h3 className="font-bold text-blue-800">Pedidos em Rota - Separação por Cestinha</h3>
                    </div>
                    <p className="text-sm text-blue-700">
                      📦 <strong>Separe os pedidos nas cestinhas de acordo com a cor do entregador</strong>
                    </p>
                  </div>
                  
                  {/* Cestinhas por Cor */}
                  {Object.entries(ordersByDriverColor).map(([color, data]) => {
                    const sectorNames = Array.from(data.sectors).map(sectorId => {
                      const sector = sectors.find(s => s.id === sectorId);
                      return sector?.name || sectorId;
                    });
                    
                    return (
                      <div 
                        key={color} 
                        className="bg-white rounded-xl shadow-lg border-4 overflow-hidden"
                        style={{ borderColor: color }}
                      >
                        {/* Header da Cestinha - Cor e Entregador */}
                        <div 
                          className="p-4 text-white"
                          style={{ backgroundColor: color }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-3 rounded-full">
                                <Truck className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="font-bold text-lg">{data.driver.name}</h4>
                                <p className="text-sm text-white/90">{data.driver.phone}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="bg-white/20 px-4 py-2 rounded-lg">
                                <div className="text-2xl font-bold">{data.orders.length}</div>
                                <div className="text-xs text-white/80">pedidos</div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Setores Atribuídos */}
                          <div className="mt-3 pt-3 border-t border-white/20">
                            <p className="text-xs text-white/80 font-bold mb-2">🗺️ SETORES DESTA ROTA:</p>
                            <div className="flex flex-wrap gap-2">
                              {sectorNames.map((sectorName, idx) => (
                                <span 
                                  key={idx}
                                  className="bg-white/25 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm"
                                >
                                  {sectorName}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Lista de Pedidos da Cestinha */}
                        <div className="p-4 space-y-3">
                          {data.orders.map(order => (
                            <div 
                              key={order.orderId} 
                              className="bg-gray-50 rounded-lg p-3 border-l-4"
                              style={{ borderLeftColor: color }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-lg text-gray-800">#{order.orderId}</span>
                                    {order.deliverySector && (
                                      <span 
                                        className="text-xs font-bold px-2 py-0.5 rounded text-white"
                                        style={{ backgroundColor: sectors.find(s => s.id === order.deliverySector)?.color || '#9CA3AF' }}
                                      >
                                        {sectors.find(s => s.id === order.deliverySector)?.name || order.deliverySector}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                    <User className="w-4 h-4" />
                                    <span className="font-medium">{order.customerName}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone className="w-4 h-4" />
                                    <span>{order.customerPhone}</span>
                                  </div>
                                  
                                  <div className="flex items-start gap-2 text-sm text-gray-600 mt-1">
                                    <MapPin className="w-4 h-4 mt-0.5" />
                                    <span>{order.address || 'Endereço não informado'}</span>
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <div className="text-lg font-bold text-gray-800">
                                    R$ {order.total.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formatTime(order.createdAt)}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Itens do Pedido (compacto) */}
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs font-bold text-gray-500 mb-1">ITENS:</p>
                                <div className="space-y-0.5">
                                  {order.items.map((item, idx) => (
                                    <div key={idx} className="text-xs text-gray-700 flex justify-between">
                                      <span>{item.quantity}x {item.name}</span>
                                      <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                                
                                {/* 🆕 Informação de Troco */}
                                {order.paymentMethod?.toLowerCase().includes('cash') && (order as any).changeFor && (
                                  <div className="mt-2 p-2 bg-green-100 border-2 border-green-400 rounded">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-base">💵</span>
                                      <p className="font-bold text-green-800 text-[10px] uppercase">Troco</p>
                                    </div>
                                    <div className="space-y-0.5 text-[10px]">
                                      <div className="flex justify-between">
                                        <span className="text-gray-700">Pagar com:</span>
                                        <span className="font-bold">R$ {((order as any).changeFor).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-green-800">
                                        <span className="font-bold">Devolver:</span>
                                        <span className="font-bold text-sm">R$ {((order as any).changeFor - order.total).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Nenhum pedido em rota</p>
              <p className="text-sm text-gray-500 mt-1">Quando um entregador iniciar a rota, os pedidos aparecerão aqui</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="space-y-4">
          {/* Pedidos Concluídos do Histórico */}
          {completedOrders.length > 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-700" />
                <h3 className="font-bold text-green-800">Pedidos Concluídos Hoje</h3>
                <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                  {completedOrders.filter((o: Order) => {
                    const getBusinessDate = (date: Date | string) => {
                      const d = new Date(date);
                      const businessTime = new Date(d.getTime() - (4 * 60 * 60 * 1000));
                      return businessTime.toDateString();
                    };
                    const todayBusinessDay = getBusinessDate(new Date());
                    const completionDate = (o as any).completedAt || (o as any).updatedAt || o.createdAt;
                    return getBusinessDate(completionDate) === todayBusinessDay;
                  }).length}
                </span>
              </div>
              
              <div className="space-y-2">
                {completedOrders
                  .filter((o: Order) => {
                    const getBusinessDate = (date: Date | string) => {
                      const d = new Date(date);
                      const businessTime = new Date(d.getTime() - (4 * 60 * 60 * 1000));
                      return businessTime.toDateString();
                    };
                    const todayBusinessDay = getBusinessDate(new Date());
                    const completionDate = (o as any).completedAt || (o as any).updatedAt || o.createdAt;
                    return getBusinessDate(completionDate) === todayBusinessDay;
                  })
                  .map((order: Order) => (
                  <div key={order.orderId} className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-gray-800">#{order.orderId}</span>
                          <span className="text-xs text-gray-500">
                            {formatTime((order as any).completedAt || (order as any).updatedAt || order.createdAt)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <User className="w-4 h-4" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{order.customerPhone}</span>
                        </div>
                        
                        <div className="flex items-start gap-2 text-sm text-gray-600 mt-1">
                          <MapPin className="w-4 h-4 mt-0.5" />
                          <span>{order.address || 'Endereço não informado'}</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-800">
                          R$ {order.total.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Pedido: {formatTime(order.createdAt)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Informações do Entregador */}
                    {order.driver && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                            style={{ backgroundColor: order.driver.color || '#3B82F6' }}
                          >
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{order.driver.name}</p>
                            <p className="text-xs text-gray-500">{order.driver.phone}</p>
                          </div>
                          <div className="ml-auto">
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                              ✅ Concluído
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!order.driver && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                        <p className="text-xs text-gray-500 italic">Sem informações do entregador</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Nenhum pedido concluído hoje</p>
              <p className="text-sm text-gray-500 mt-1">Quando um entregador concluir uma entrega, os pedidos aparecerão aqui</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="space-y-4">
          {/* Lista de Entregadores */}
          {drivers.length > 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-5 h-5 text-green-700" />
                <h3 className="font-bold text-green-800">Entregadores Online</h3>
                <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                  {drivers.length}
                </span>
              </div>
              
              <div className="space-y-2">
                {drivers.map(driver => (
                  <div key={driver.name} className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                          style={{ backgroundColor: driver.color }}
                        >
                          <Truck className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-lg">{driver.name}</span>
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              Online
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{driver.phone}</p>
                          <p className="text-xs text-gray-500">Último login: {new Date(driver.lastLogin).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                          <div className="text-2xl font-bold text-blue-800">
                            {driver.computedStats?.today || 0}
                          </div>
                          <div className="text-xs text-blue-600 uppercase font-bold">
                            Hoje
                          </div>
                        </div>
                        {driver.computedStats && (
                          <div className="mt-2 text-xs text-gray-500">
                            Mês: {driver.computedStats.month} | Total: {driver.computedStats.total}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Botão de Forçar Logout */}
                    {driver.status === 'online' && (
                      <div className="pt-3 border-t border-gray-200">
                        <button
                          onClick={() => handleForceLogout(driver)}
                          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                        >
                          <X className="w-4 h-4" />
                          Forçar Logout
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Nenhum entregador online no momento</p>
              <p className="text-sm text-gray-500 mt-1">Os entregadores aparecerão aqui automaticamente quando fizerem login</p>
              <p className="text-xs text-gray-400 mt-3">🔄 Atualização automática a cada 1 segundo</p>
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>🔄 Atualização automática a cada 1 segundo</p>
      </div>

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                <Settings className="w-6 h-6 text-gray-600" />
                Configuração Diária
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Configure os entregadores que trabalharão hoje. <br/>
                Para cada entregador, adicione uma vaga e defina uma cor única (ex: cor da mochila/colete).
              </p>
            </div>

             <div className="mb-6">
                 <div className="flex justify-between items-center mb-4">
                   <label className="block text-sm font-bold text-gray-700">
                     Entregadores Permitidos
                   </label>
                   <button
                     onClick={() => setDeliveryConfig(prev => ({
                       ...prev,
                       activeColors: [...prev.activeColors, '#000000']
                     }))}
                     className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                   >
                     <span className="text-lg leading-none">+</span> Adicionar Entregador
                   </button>
                 </div>

                 <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[100px]">
                   {deliveryConfig.activeColors.length === 0 ? (
                     <p className="text-gray-500 text-center text-sm py-4">
                       Nenhum entregador configurado. <br/>
                       Clique em "Adicionar" para definir as cores/vagas.
                     </p>
                   ) : (
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                       {deliveryConfig.activeColors.map((color, index) => (
                         <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                           <div className="relative group">
                             <div 
                               className="w-10 h-10 rounded-full shadow-sm border border-gray-200" 
                               style={{ backgroundColor: color }}
                             />
                             <input
                               type="color"
                               value={color}
                               onChange={(e) => {
                                 const newColors = [...deliveryConfig.activeColors];
                                 newColors[index] = e.target.value;
                                 setDeliveryConfig(prev => ({ ...prev, activeColors: newColors }));
                               }}
                               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                             />
                           </div>
                           
                           <div className="flex-1 min-w-0">
                             <p className="text-xs text-gray-500 font-mono truncate">{color}</p>
                             <p className="text-xs font-bold text-gray-700">Entregador {index + 1}</p>
                           </div>

                           <button
                             onClick={() => {
                               const newColors = deliveryConfig.activeColors.filter((_, i) => i !== index);
                               setDeliveryConfig(prev => ({ ...prev, activeColors: newColors }));
                             }}
                             className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                           >
                             <X className="w-4 h-4" />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
                 
                 <p className="text-xs text-gray-500 mt-2">
                   * Cada cor adicionada representa uma vaga de entregador. O entregador deverá selecionar a cor exata no login.
                 </p>
              </div>

            <div className="mb-6">
               <label className="block text-sm font-bold text-gray-700 mb-2">
                Total de Vagas:
              </label>
              <div className="text-3xl font-bold text-gray-800 bg-gray-100 p-4 rounded-lg text-center border-2 border-gray-200">
                {deliveryConfig.activeColors.length}
                <span className="text-sm text-gray-500 ml-2 font-normal">entregadores</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                {isSavingConfig ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}