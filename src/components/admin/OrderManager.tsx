import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, CheckCircle, Truck, Package, MapPin, Phone, User, Filter, Loader, RefreshCw, Printer, XCircle, MessageSquare, Send, Store, Star, Wifi, WifiOff, Bell, BellOff } from 'lucide-react';
import * as api from '../../utils/api';
import { usePrinter } from '../PrinterManager';
import type { OrderPrintData } from '../../utils/thermalPrinter';
import { useConfig } from '../../ConfigContext';
import { useOrdersRealtime } from '../../hooks/useRealtime';

// 🔔 Som de notificação gerado via Web Audio API (sem arquivo externo)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Tocar 3 beeps curtos
    const playBeep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    };

    const now = ctx.currentTime;
    playBeep(now, 880);        // A5
    playBeep(now + 0.35, 1100); // ~C#6
    playBeep(now + 0.7, 1320);  // E6
    
    // Fechar contexto depois
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch (e) {
    console.warn('🔔 [NOTIFY] Erro ao tocar som:', e);
  }
}

// 🔔 Mostrar notificação do browser
function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { 
        body, 
        icon: '/favicon.ico',
        tag: 'new-order', // Substitui notificação anterior
        requireInteraction: true, // Não desaparece sozinha
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {
      console.warn('🔔 [NOTIFY] Erro na notificação:', e);
    }
  }
}

type OrderStatus = 'pending' | 'preparing' | 'packing' | 'ready_for_delivery' | 'out_for_delivery' | 'ready_for_pickup' | 'completed' | 'cancelled';

interface Order {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  deliverySector?: string; // ID do setor de entrega
  cardType?: 'credit' | 'debit'; // Adicionado tipo de cartão
  changeFor?: number; // Adicionado troco
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
  reviews?: Array<{ productName: string, rating: number, comment: string }>; // Adicionado
  selectedAcompanhamentos?: Array<{ id: string; name: string } | string>; // Acompanhamentos selecionados
}

export function OrderManager() {
  const { config } = useConfig();
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]); // Novo estado para histórico
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all' | 'history'>('all'); // Adicionado 'history'
  const [sectors, setSectors] = useState<Array<{id: string, name: string, color: string}>>([]);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set()); // Rastrear pedidos sendo atualizados

  // 🔔 Sistema de notificação de novos pedidos
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    return localStorage.getItem('admin_notify_orders') !== 'false'; // Ativado por padrão
  });
  const [notifyPermission, setNotifyPermission] = useState<string>('default');
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const notifyEnabledRef = useRef(notifyEnabled);

  // Manter ref sincronizado
  useEffect(() => {
    notifyEnabledRef.current = notifyEnabled;
  }, [notifyEnabled]);

  // Pedir permissão de notificação na montagem
  useEffect(() => {
    if ('Notification' in window) {
      setNotifyPermission(Notification.permission);
      if (Notification.permission === 'default' && notifyEnabled) {
        Notification.requestPermission().then(p => setNotifyPermission(p));
      }
    }
  }, []);

  // Salvar preferência
  useEffect(() => {
    localStorage.setItem('admin_notify_orders', String(notifyEnabled));
  }, [notifyEnabled]);

  const toggleNotify = () => {
    const next = !notifyEnabled;
    setNotifyEnabled(next);
    if (next && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifyPermission(p));
    }
  };

  // Printer integration
  const { isConnected, printOrder: printOrderReceipt } = usePrinter();

  // Helper para buscar nome do setor pelo ID
  const getSectorName = (sectorId?: string) => {
    if (!sectorId) return null;
    const sector = sectors.find(s => s.id === sectorId);
    return sector ? sector.name : null;
  };

  // Helper para enviar mensagem no WhatsApp
  const sendWhatsAppUpdate = (order: Order, type: 'confirm' | 'delivery' | 'ready' | 'custom') => {
    const phone = order.customerPhone.replace(/\D/g, '');
    const name = order.customerName.split(' ')[0]; // Primeiro nome
    const sectorName = getSectorName(order.deliverySector);
    let message = '';

    switch (type) {
      case 'confirm':
        message = `Olá *${name}*! 👋\n\nConfirmamos seu pedido *#${order.orderId}* no Faroeste Lanches. 🤠\n\nJá vamos começar a preparar tudo com muito carinho! 👨‍🍳🔥`;
        break;
      case 'delivery':
        message = `Olá *${name}*! 🛵\n\nSeu pedido *#${order.orderId}* acabou de sair para entrega!${sectorName ? `\n📍 Destino: ${sectorName}` : ''}\n\nFique de olho na campainha/interfone. Bom apetite! 😋`;
        break;
      case 'ready':
        message = `Olá *${name}*! 🛍️\n\nSeu pedido *#${order.orderId}* já está pronto para retirada aqui no balcão.\n\nAguardamos você! 😉`;
        break;
      case 'custom':
        message = `Olá *${name}*, sobre seu pedido *#${order.orderId}*: `;
        break;
    }

    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    loadOrders();
    loadHistory(); // Carregar histórico
    loadSectors(); // Carregar setores
    // Polling agora é gerenciado pelo useOrdersRealtime hook
    
    // 🔔 Polling de segurança para notificações (funciona com aba minimizada)
    // O realtime pode não funcionar em background, então polling garante
    const bgPoll = setInterval(() => {
      if (notifyEnabledRef.current) {
        loadOrders();
      }
    }, 15000); // A cada 15 segundos
    
    return () => clearInterval(bgPoll);
  }, []);

  // Realtime: substitui o polling de 3s
  const { isRealtimeConnected } = useOrdersRealtime(useCallback(() => {
    loadOrders();
  }, []), true);

  const loadHistory = async () => {
    try {
      console.log('📚 [ORDER MANAGER] Carregando histórico...');
      const response = await api.getOrderHistory();
      console.log('📦 [ORDER MANAGER] Histórico recebido:', response);
      
      if (response.success) {
        setHistoryOrders(response.orders || []);
        console.log('✅ [ORDER MANAGER] Total de pedidos no histórico:', response.orders?.length || 0);
      }
    } catch (error) {
      console.error('❌ [ORDER MANAGER] Erro ao carregar histórico:', error);
    }
  };

  const loadSectors = async () => {
    try {
      console.log('📍 [ORDER MANAGER] Carregando setores...');
      const response = await api.getDeliverySectors();
      if (response.success && response.sectors) {
        setSectors(response.sectors);
        console.log('✅ [ORDER MANAGER] Setores carregados:', response.sectors.length);
      }
    } catch (error) {
      console.error('❌ [ORDER MANAGER] Erro ao carregar setores:', error);
    }
  };

  const loadOrders = async () => {
    try {
      console.log('🔄 [ORDER MANAGER] Carregando pedidos...');
      const response = await api.getAllOrders();
      console.log('📦 [ORDER MANAGER] Pedidos recebidos:', response);
      
      if (response.success) {
        // Deduplicar pedidos por ID para evitar exibição duplicada
        const uniqueOrders = response.orders ? Array.from(new Map(response.orders.map((o: any) => [o.orderId, o])).values()) : [];
        
        // 🔔 Detectar novos pedidos
        if (!isFirstLoadRef.current && notifyEnabledRef.current) {
          const currentIds = new Set((uniqueOrders as Order[]).map(o => o.orderId));
          const newOrders = (uniqueOrders as Order[]).filter(o => !knownOrderIdsRef.current.has(o.orderId));
          
          if (newOrders.length > 0) {
            console.log(`🔔 [NOTIFY] ${newOrders.length} novo(s) pedido(s)!`);
            playNotificationSound();
            
            const firstNew = newOrders[0] as Order;
            const body = newOrders.length === 1
              ? `${firstNew.customerName} — R$ ${firstNew.total?.toFixed(2).replace('.', ',')}`
              : `${newOrders.length} novos pedidos recebidos`;
            showBrowserNotification('🔔 Novo Pedido!', body);
          }
        }
        
        // Atualizar IDs conhecidos
        knownOrderIdsRef.current = new Set((uniqueOrders as Order[]).map(o => o.orderId));
        isFirstLoadRef.current = false;
        
        setOrders(uniqueOrders as Order[]);
        console.log('✅ [ORDER MANAGER] Total de pedidos (únicos):', uniqueOrders.length);
      }
    } catch (error) {
      console.error('❌ [ORDER MANAGER] Erro ao carregar pedidos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    // Proteção contra duplo clique - previne pedidos duplicados
    if (updatingOrderIds.has(orderId)) {
      console.log('⚠️ [ORDER MANAGER] Atualização já em andamento para:', orderId);
      return; // Ignora clique se já está processando
    }
    
    try {
      // Marcar como "processando"
      setUpdatingOrderIds(prev => new Set(prev).add(orderId));
      
      console.log('🔄 [ORDER MANAGER] Atualizando status:', { orderId, newStatus });
      
      // Lógica de confirmação para notificações WhatsApp
      const order = orders.find(o => o.orderId === orderId);
      let shouldNotify = false;
      let notificationType: 'confirm' | 'delivery' | 'ready' | null = null;

      // Só pergunta se deve notificar se o acompanhamento de pedido estiver ATIVADO
      // OU se for status "Pronto" (mesmo desativado, pode querer avisar que está pronto)
      // Regra: "só sugerir envio de WhatsApp no status 'Pronto'"
      
      const isTrackingEnabled = config.features?.orderTracking !== false;

      if (order) {
        // Notificações de Status Intermediários (Desativadas por padrão conforme solicitação)
        /* 
        if (newStatus === 'preparing' && order.status === 'pending' && isTrackingEnabled) {
           shouldNotify = confirm('Pedido aceito! Deseja avisar o cliente no WhatsApp?');
           notificationType = 'confirm';
        } else if (newStatus === 'out_for_delivery' && isTrackingEnabled) {
           shouldNotify = confirm('Saiu para entrega! Deseja avisar o cliente?');
           notificationType = 'delivery';
        }
        */

        // Notificação de Pedido Pronto (Sempre sugere, pois é crítico para retirada)
        if (newStatus === 'ready_for_pickup') {
          shouldNotify = confirm('Pedido PRONTO! Deseja avisar o cliente no WhatsApp agora?');
          notificationType = 'ready';
        }
      }

      // Atualizar localmente primeiro (optimistic update)
      setOrders(orders.map(order =>
        order.orderId === orderId ? { ...order, status: newStatus } : order
      ));

      // Atualizar no servidor
      const response = await api.updateOrderStatus(orderId, newStatus);
      
      if (!response.success) {
        console.error('❌ [ORDER MANAGER] Erro na resposta:', response.error);
        alert('Erro ao atualizar status do pedido');
        await loadOrders();
      } else {
        console.log('✅ [ORDER MANAGER] Status atualizado com sucesso');
        
        // Forçar atualização dos dados reais após breve delay para garantir persistência
        setTimeout(() => {
            loadOrders();
            // Se o pedido foi concluído, recarregar o histórico também
            if (newStatus === 'completed') {
              loadHistory();
            }
        }, 1000);

        // Enviar notificação se confirmado
        if (shouldNotify && notificationType && order) {
           sendWhatsAppUpdate(order, notificationType);
        }
      }
    } catch (error) {
      console.error('❌ [ORDER MANAGER] Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do pedido');
      await loadOrders();
    } finally {
      // Remover da lista de "processando" após 2 segundos (tempo seguro)
      setTimeout(() => {
        setUpdatingOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }, 2000);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm('⚠️ Tem certeza que deseja CANCELAR este pedido?\n\nEsta ação não pode ser desfeita!')) {
      try {
        console.log('🚫 [ORDER MANAGER] Cancelando pedido:', orderId);
        
        // Atualizar status localmente primeiro (optimistic update)
        setOrders(orders.map(order =>
          order.orderId === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
        ));
        setHistoryOrders(prev => prev.map(order =>
          order.orderId === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
        ));
        
        // Chamar API do backend
        const result = await api.cancelOrder(orderId);
        
        if (result.success) {
          console.log('✅ [ORDER MANAGER] Pedido cancelado com sucesso:', result.order);
          // Recarregar pedidos para obter estado atualizado
          await loadOrders();
          await loadHistory();
        } else {
          console.error('❌ [ORDER MANAGER] Erro ao cancelar pedido:', result.error);
          alert(`Erro ao cancelar pedido: ${result.error}`);
          await loadOrders();
          await loadHistory();
        }
      } catch (error) {
        console.error('❌ [ORDER MANAGER] Erro de rede ao cancelar pedido:', error);
        alert('Erro de conexão. Tente novamente.');
        await loadOrders();
        await loadHistory();
      }
    }
  };

  const getStatusInfo = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock };
      case 'preparing':
        return { label: 'Preparando', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Clock };
      case 'packing':
        return { label: 'Embalando', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Package };
      case 'ready_for_delivery':
        return { label: 'Pronto para Entrega', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: Package };
      case 'out_for_delivery':
        return { label: 'Saiu para Entrega', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: Truck };
      case 'ready_for_pickup':
        return { label: 'Pronto para Retirada', color: 'bg-green-100 text-green-800 border-green-300', icon: Package };
      case 'completed':
        return { label: 'Concluído', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: CheckCircle };
      case 'cancelled':
        return { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 border-gray-300', icon: Clock };
    }
  };

  const getNextStatusOptions = (currentStatus: Order['status'], deliveryType: 'delivery' | 'pickup' | 'dine-in') => {
    const deliverySystemEnabled = config.features?.deliverySystem !== false;
    
    if (deliveryType === 'delivery') {
      // SEMPRE mostrar fluxo completo de status (admin pode atualizar manualmente)
      // Sistema de entregas desativado = sem controle automático de entregadores, mas status manual OK
      switch (currentStatus) {
        case 'pending':
          return [{ value: 'preparing' as const, label: 'Preparando' }];
        case 'preparing':
          return [{ value: 'packing' as const, label: 'Embalando' }];
        case 'packing':
          return [{ value: 'ready_for_delivery' as const, label: 'Pronto para Entrega' }];
        case 'ready_for_delivery':
          return [{ value: 'out_for_delivery' as const, label: 'Saiu para Entrega' }];
        case 'out_for_delivery':
          return [{ value: 'completed' as const, label: 'Entregue' }];
        default:
          return [];
      }
    } else if (deliveryType === 'pickup') {
      switch (currentStatus) {
        case 'pending':
          return [{ value: 'preparing' as const, label: 'Preparando' }];
        case 'preparing':
          return [{ value: 'ready_for_pickup' as const, label: 'Pronto para Retirada' }];
        case 'ready_for_pickup':
          return [{ value: 'completed' as const, label: 'Retirado' }];
        default:
          return [];
      }
    } else {
      switch (currentStatus) {
        case 'pending':
          return [{ value: 'preparing' as const, label: 'Preparando' }];
        case 'preparing':
          return [{ value: 'completed' as const, label: 'Concluído' }];
        default:
          return [];
      }
    }
  };

  const getTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes} min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const filteredOrders = (filterStatus === 'all'
    ? orders.filter(o => {
        const isActiveStatus = o.status !== 'completed' && o.status !== 'cancelled';
        
        // Filtrar pedidos antigos "esquecidos" (mais de 24h) da visualização principal
        const orderDate = new Date(o.createdAt);
        const now = new Date();
        const diffHours = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
        
        // Apenas oculta se tiver sido concluído/cancelado OU se for muito antigo (> 24h)
        return isActiveStatus && diffHours < 24;
    })
    : orders.filter(o => o.status === filterStatus))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Ordenar mais recentes primeiro

  // CORREÇÃO: Buscar pedidos concluídos do HISTÓRICO (não dos ativos)
  const completedOrders = historyOrders
    .filter(o => o.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Ordenar mais recentes primeiro
  
  console.log('📊 [ORDER MANAGER DEBUG] Pedidos concluídos:', completedOrders.length, 'de', historyOrders.length, 'no histórico');
  
  // Cancelados ou Expirados (de ativos + histórico)
  const cancelledFromActive = orders.filter(o => {
    if (o.status === 'cancelled') return true;
    // Antigos não finalizados (> 24h)
    const isActiveStatus = o.status !== 'completed' && o.status !== 'cancelled';
    const orderDate = new Date(o.createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
    return isActiveStatus && diffHours >= 24;
  });
  const cancelledFromHistory = historyOrders.filter(o => o.status === 'cancelled');
  // Mesclar sem duplicatas
  const cancelledMap = new Map<string, Order>();
  [...cancelledFromActive, ...cancelledFromHistory].forEach(o => cancelledMap.set(o.orderId, o));
  const cancelledOrders = Array.from(cancelledMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statusFilters = [
    { value: 'all' as const, label: 'Ativos (24h)', count: filteredOrders.length },
    { value: 'pending' as const, label: 'Aguardando', count: orders.filter(o => o.status === 'pending').length },
    { value: 'preparing' as const, label: 'Preparando', count: orders.filter(o => o.status === 'preparing').length },
    { value: 'packing' as const, label: 'Embalando', count: orders.filter(o => o.status === 'packing').length },
    { value: 'out_for_delivery' as const, label: 'Em Rota', count: orders.filter(o => o.status === 'out_for_delivery').length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Gerenciar Pedidos</h1>
            <p className="text-gray-600">Acompanhe e atualize o status dos pedidos em tempo real</p>
          </div>
          
          {/* Store Address Badge */}
          <div className="flex items-center gap-3">
            {/* 🔔 Botão de notificação */}
            <button
              onClick={toggleNotify}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                notifyEnabled
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
              title={notifyEnabled ? 'Notificações ativadas' : 'Notificações desativadas'}
            >
              {notifyEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{notifyEnabled ? 'Alarme ON' : 'Alarme OFF'}</span>
              {notifyEnabled && notifyPermission !== 'granted' && (
                <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 rounded font-bold">Permitir</span>
              )}
            </button>

            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2 text-sm text-blue-800 shadow-sm">
              <Store className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Local da Loja</p>
                <p className="font-medium">{config.address || 'Endereço não configurado'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="mb-6 flex gap-2 flex-wrap items-center">
        <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        {statusFilters.map(filter => (
          <button
            key={filter.value}
            onClick={() => setFilterStatus(filter.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              filterStatus === filter.value
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {filter.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              filterStatus === filter.value
                ? 'bg-white text-green-600'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      {/* Active Orders */}
      {filterStatus !== 'history' && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-green-600" />
            Pedidos Ativos ({filteredOrders.length})
          </h2>

          {isLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <Loader className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">Carregando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <CheckCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">Nenhum pedido ativo no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredOrders.map(order => {
                const statusInfo = getStatusInfo(order.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 transition-all"
                  >
                    {/* Header */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">#{order.orderId}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{getTimeAgo(new Date(order.createdAt))}</p>
                    </div>

                    {/* Customer Info */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <a href={`tel:${order.customerPhone}`} className="hover:text-green-600 dark:hover:text-green-400 font-medium">
                            {order.customerPhone}
                          </a>
                          <button 
                            onClick={() => sendWhatsAppUpdate(order, 'custom')}
                            className="ml-2 p-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            title="Conversar no WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </button>
                        </div>
                        
                        {/* Endereço - Lógica dinâmica: 
                            Se for Entrega -> Mostra endereço do cliente (salvo no pedido)
                            Se for Retirada/Local -> Mostra endereço da loja (config atual) */}
                        {(order.deliveryType === 'delivery' ? order.address : (config.address || order.address)) && (
                          <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                            <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="block">
                                {order.deliveryType === 'delivery' 
                                  ? order.address 
                                  : (config.address || order.address)}
                              </span>
                              {/* Badge do Setor de Entrega */}
                              {order.deliveryType === 'delivery' && getSectorName(order.deliverySector) && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  📍 Setor: {getSectorName(order.deliverySector)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.deliveryType === 'delivery'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                              : order.deliveryType === 'dine-in'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          }`}>
                            {order.deliveryType === 'delivery' ? '🚚 Entrega' : order.deliveryType === 'dine-in' ? '🍽️ Consumir no Local' : '🏪 Retirada'}
                          </span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            💳 {order.paymentMethod} {order.cardType && `(${order.cardType === 'credit' ? 'Crédito' : 'Débito'})`}
                          </span>
                          {/* Badge do Setor (também na linha de badges) */}
                          {order.deliveryType === 'delivery' && getSectorName(order.deliverySector) && (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
                              📍 {getSectorName(order.deliverySector)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="p-4 bg-gray-50">
                      <h4 className="font-semibold text-gray-800 mb-2 text-sm">Itens do Pedido:</h4>
                      <div className="space-y-1 mb-3">
                        {order.items.map((item: any, idx: number) => {
                          const addonsTotal = (item.selectedAddons || []).reduce((a: number, addon: any) => a + addon.price, 0);
                          return (
                            <div key={idx}>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.quantity}x {item.name}</span>
                                <span className="text-gray-600">R$ {((item.price + addonsTotal) * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.selectedAddons && item.selectedAddons.length > 0 && (
                                <div className="ml-6 space-y-0.5">
                                  {item.selectedAddons.map((addon: any, aIdx: number) => (
                                    <div key={aIdx} className="flex justify-between text-xs text-purple-600">
                                      <span>+ {addon.name}</span>
                                      <span>{addon.price > 0 ? `+R$ ${addon.price.toFixed(2)}` : 'Grátis'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Acompanhamentos selecionados pelo cliente */}
                      {order.selectedAcompanhamentos && order.selectedAcompanhamentos.length > 0 && order.deliveryType !== 'dine-in' && (
                        <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">🍟 Molhos / Acompanhamentos</p>
                          <div className="flex flex-wrap gap-1">
                            {order.selectedAcompanhamentos.map((acomp: any, idx: number) => (
                              <span key={idx} className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">
                                {typeof acomp === 'string' ? acomp : acomp.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t border-gray-300 pt-2 flex justify-between font-bold">
                        <span className="text-gray-800">Total</span>
                        <span className="text-green-600 text-lg">R$ {order.total.toFixed(2)}</span>
                      </div>

                      {/* Informação de Cartão */}
                      {order.paymentMethod?.toLowerCase().includes('card') && order.cardType && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">💳</span>
                            <div>
                              <p className="font-bold text-amber-800 text-xs uppercase">Tipo de Cartão</p>
                              <p className="text-amber-900 font-bold text-sm">
                                Pagamento no {order.cardType === 'credit' ? 'CRÉDITO' : 'DÉBITO'}
                              </p>
                              {!config.automaticPayment && (
                                <p className="text-[10px] text-amber-600 font-medium">Levar maquininha na entrega</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Informação de Troco */}
                      {order.paymentMethod?.toLowerCase().includes('cash') && (order as any).changeFor && (
                        <div className="mt-3 p-3 bg-green-100 border-2 border-green-400 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">💵</span>
                            <p className="font-bold text-green-800 text-xs uppercase">Troco Necessário</p>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-700">Cliente vai pagar com:</span>
                              <span className="font-bold text-gray-900">R$ {((order as any).changeFor).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">Total do pedido:</span>
                              <span className="font-bold text-gray-900">R$ {order.total.toFixed(2)}</span>
                            </div>
                            <div className="border-t-2 border-green-300 pt-2 flex justify-between">
                              <span className="text-green-800 font-bold">Troco a devolver:</span>
                              <span className="font-bold text-green-800 text-base">R$ {((order as any).changeFor - order.total).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 flex gap-2 flex-wrap">
                      {/* Botão Confirmar Pagamento (Apenas para PIX - outros métodos são automáticos) */}
                      {order.status === 'pending' && order.paymentMethod.toLowerCase().includes('pix') && (
                        <button
                          onClick={() => {
                             if (confirm('Confirma o recebimento do pagamento? O pedido irá para "Preparando".')) {
                               updateOrderStatus(order.orderId, 'preparing');
                             }
                          }}
                          disabled={updatingOrderIds.has(order.orderId)}
                          className={`w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-bold transition-colors text-sm flex items-center justify-center gap-2 shadow-sm ${updatingOrderIds.has(order.orderId) ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}`}
                        >
                          {updatingOrderIds.has(order.orderId) ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              PROCESSANDO...
                            </>
                          ) : (
                            <>
                              <span className="text-lg">💰</span>
                              CONFIRMAR PAGAMENTO PIX
                            </>
                          )}
                        </button>
                      )}

                      {/* Se Order Tracking estiver ATIVADO, mostra fluxo normal */}
                      {(config.features?.orderTracking !== false) && getNextStatusOptions(order.status, order.deliveryType).map(option => (
                        <button
                          key={option.value}
                          onClick={() => updateOrderStatus(order.orderId, option.value)}
                          disabled={updatingOrderIds.has(order.orderId)}
                          className={`flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors text-sm ${updatingOrderIds.has(order.orderId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {option.label}
                        </button>
                      ))}

                      {/* Botão Concluir (Sempre aparece se não estiver concluído) */}
                      {order.status !== 'completed' && (
                        <button
                          onClick={() => updateOrderStatus(order.orderId, 'completed')}
                          disabled={updatingOrderIds.has(order.orderId)}
                          className={`${config.features?.orderTracking === false ? 'flex-1 bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'} py-2 px-4 rounded-lg font-medium transition-colors text-sm ${updatingOrderIds.has(order.orderId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          ✓ Concluir
                        </button>
                      )}
                      {(config.features?.thermalPrinter !== false) && (
                        <button
                          onClick={() => printOrderReceipt(order)}
                          className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                          disabled={!isConnected}
                          title={!isConnected ? 'Impressora não conectada' : 'Imprimir cupom'}
                        >
                          <Printer className="w-4 h-4" />
                          🖨️
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelOrder(order.orderId)}
                        className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Completed Orders - SEMPRE APARECE, mesmo se vazio */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          Pedidos Concluídos ({completedOrders.length})
        </h2>
        
        {completedOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum pedido concluído ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedOrders.map(order => {
              // Calcular média de avaliação do pedido (se houver)
              const averageRating = order.reviews && order.reviews.length > 0
                ? order.reviews.reduce((acc, r) => acc + r.rating, 0) / order.reviews.length
                : 0;

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200 opacity-75 hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800">#{order.orderId}</h3>
                    <div className="flex items-center gap-2">
                      {(config.features?.reviews !== false) && averageRating > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3 fill-yellow-600" />
                          {averageRating.toFixed(1)}
                        </span>
                      )}
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{order.customerName}</p>
                  <p className="text-sm text-gray-500 mb-2">{getTimeAgo(new Date(order.createdAt))}</p>
                  
                  {/* LISTA DE PRODUTOS */}
                  {order.items && order.items.length > 0 && (
                    <div className="mb-3 bg-green-50 p-2 rounded border border-green-200">
                      <p className="text-xs font-bold text-green-800 mb-1 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Produtos:
                      </p>
                      <div className="space-y-1">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-700">
                                <span className="font-bold text-green-700">{item.quantity}x</span> {item.name}
                              </span>
                              <span className="text-gray-600 font-medium">
                                R$ {item.price.toFixed(2)}
                              </span>
                            </div>
                            {item.selectedAddons && item.selectedAddons.length > 0 && (
                              <div className="ml-6 space-y-0.5">
                                {item.selectedAddons.map((addon: any, aIdx: number) => (
                                  <div key={aIdx} className="flex justify-between text-[10px] text-purple-600">
                                    <span>+ {addon.name}</span>
                                    <span>{addon.price > 0 ? `+R$ ${addon.price.toFixed(2)}` : 'Grátis'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Endereço Completo */}
                  {order.address && (
                    <div className="mb-3 bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-600">Endereço:</p>
                          <p className="text-xs text-gray-700">{order.address}</p>
                          {getSectorName(order.deliverySector) && (
                            <p className="text-xs text-indigo-800 font-semibold mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-200">
                              📍 Setor: {getSectorName(order.deliverySector)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Mostrar feedback do cliente se houver (e se Reviews estiver ativo) */}
                  {(config.features?.reviews !== false) && order.reviews && order.reviews.length > 0 && (
                    <div className="mb-2 bg-yellow-50 p-2 rounded text-xs border border-yellow-100">
                      <p className="font-bold text-yellow-800 mb-2 flex items-center gap-1 border-b border-yellow-200 pb-1">
                        <Star className="w-3 h-3 fill-yellow-600" />
                        Avaliação do Cliente:
                      </p>
                      <div className="space-y-2">
                        {order.reviews.map((review, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-yellow-100">
                             <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-gray-700 truncate max-w-[120px]">{review.productName}</span>
                                <div className="flex">
                                  {[1,2,3,4,5].map(s => (
                                    <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                  ))}
                                </div>
                             </div>
                             {review.comment && (
                               <p className="text-gray-600 italic mt-1 border-t border-gray-100 pt-1 break-words">"{review.comment}"</p>
                             )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="font-bold text-green-600">R$ {order.total.toFixed(2)}</p>
                  
                  {/* Cancelar pedido concluído */}
                  <button
                    onClick={() => handleCancelOrder(order.orderId)}
                    className="mt-2 w-full bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-lg font-medium transition-colors text-xs flex items-center justify-center gap-1 border border-red-200"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancelar Pedido
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancelled Orders - SEMPRE APARECE */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <XCircle className="w-6 h-6 text-red-600" />
          Pedidos Cancelados ({cancelledOrders.length})
        </h2>

        {cancelledOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum pedido cancelado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cancelledOrders.map(order => (
              <div key={order.id} className="bg-white rounded-lg shadow-md p-4 border-2 border-red-200 opacity-90 hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800">#{order.orderId}</h3>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Cancelado
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">{order.customerName}</p>
                <p className="text-sm text-gray-500 mb-2">{getTimeAgo(new Date(order.createdAt))}</p>

                {/* Itens do pedido */}
                {order.items && order.items.length > 0 && (
                  <div className="mb-2 bg-red-50 p-2 rounded border border-red-100">
                    <p className="text-xs font-bold text-red-800 mb-1 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Itens:
                    </p>
                    <div className="space-y-0.5">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                          <span>{item.quantity}x {item.name}</span>
                          <span>R$ {item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Endereço */}
                {order.address && (
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {order.address}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <p className="font-bold text-red-600 line-through">R$ {order.total.toFixed(2)}</p>
                  <span className="text-xs text-gray-400">{order.paymentMethod}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}