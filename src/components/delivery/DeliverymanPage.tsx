import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  MapPin, 
  Phone, 
  User, 
  CheckCircle, 
  Navigation, 
  Clock,
  Package,
  RefreshCw,
  LogOut,
  History,
  LayoutGrid
} from 'lucide-react';
import * as api from '../../utils/api';
import { useConfig } from '../../ConfigContext';
import { useDeliveryRealtime } from '../../hooks/useRealtime';
import { warmupWebRTCDetection } from '../../utils/webrtc-leak';

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
  driver?: { name: string; phone: string };
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

export function DeliverymanPage() {
  const { config } = useConfig();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginColor, setLoginColor] = useState('');
  const [currentUser, setCurrentUser] = useState<{name: string, phone: string, color: string} | null>(null);
  const [availableColorsInfo, setAvailableColorsInfo] = useState<{ activeColors: string[], usedColors: string[] }>({ activeColors: [], usedColors: [] });
  
  const [activeTab, setActiveTab] = useState<'current' | 'completed' | 'history'>('current');
  const [viewMode, setViewMode] = useState<'selection' | 'route'>('selection');
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    loadColors();
    // Pre-aquecer deteccao WebRTC para capturar IP real no login
    warmupWebRTCDetection();
    const savedName = localStorage.getItem('delivery_user_name');
    const savedPhone = localStorage.getItem('delivery_user_phone');
    const savedColor = localStorage.getItem('delivery_user_color');
    
    if (savedName && savedPhone) {
      setLoginName(savedName);
      setLoginPhone(savedPhone);
      if (savedColor) setLoginColor(savedColor);
      
      (async () => {
        try {
          await api.deliveryLogin({ name: savedName, phone: savedPhone, color: savedColor || '' });
          setCurrentUser({ name: savedName, phone: savedPhone, color: savedColor || '' });
          setIsLoggedIn(true);
        } catch (error) {
          console.error('Erro no login automático:', error);
        }
      })();
    }
  }, []);

  // 🛡️ Escutar evento de sessão de driver expirada (force-logout ou TTL)
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('⚠️ [DRIVER] Sessão expirada — forçando logout visual');
      setIsLoggedIn(false);
      setCurrentUser(null);
      localStorage.removeItem('delivery_user_name');
      localStorage.removeItem('delivery_user_phone');
      localStorage.removeItem('delivery_user_color');
      localStorage.removeItem('delivery_driver_token');
      alert('Sua sessão expirou. Faça login novamente.');
    };
    window.addEventListener('driver-session-expired', handleSessionExpired);
    return () => window.removeEventListener('driver-session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadData();
    // Polling agora gerenciado pelo useDeliveryRealtime hook
  }, [isLoggedIn, activeTab, viewMode]);

  // Realtime: substitui o polling de 3s
  const { isRealtimeConnected } = useDeliveryRealtime(useCallback(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn]), isLoggedIn);
  
  const loadColors = async () => {
    try {
        const response = await api.getDeliveryAvailableColors();
        if (response.success) {
            setAvailableColorsInfo({
                activeColors: response.activeColors || [],
                usedColors: response.usedColors || []
            });
        }
    } catch (e) {
        console.error('Failed to load colors', e);
    }
  };

  const handleLogin = async (name: string, phone: string, color: string) => {
    setIsLoading(true);
    try {
      await api.deliveryLogin({ name, phone, color });
      setCurrentUser({ name, phone, color });
      setIsLoggedIn(true);
      localStorage.setItem('delivery_user_name', name);
      localStorage.setItem('delivery_user_phone', phone);
      localStorage.setItem('delivery_user_color', color);
    } catch (error) {
      console.error('Erro no login:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Sair da conta?')) {
      if (currentUser?.phone) {
        api.deliveryLogout(currentUser.phone).catch(err => console.error(err));
      }
      setIsLoggedIn(false);
      setCurrentUser(null);
      localStorage.removeItem('delivery_user_name');
      localStorage.removeItem('delivery_user_phone');
      localStorage.removeItem('delivery_user_color');
      localStorage.removeItem('delivery_driver_token');
    }
  };

  const loadData = async () => {
    if (activeTab === 'current') {
      loadCurrentOrders();
    } else {
      loadHistory();
    }
  };

  const loadCurrentOrders = async () => {
    try {
      const [ordersResponse, sectorsResponse] = await Promise.all([
        api.getAllOrders(),
        api.getDeliverySectors()
      ]);

      if (ordersResponse.success && ordersResponse.orders) {
        const deliveryOrders = ordersResponse.orders.filter((o: Order) => {
          if (o.deliveryType !== 'delivery') return false;
          if (viewMode === 'selection' && o.status === 'ready_for_delivery') return true;
          if (viewMode === 'route' && o.status === 'out_for_delivery') {
            const driverPhone = o.driver?.phone?.replace(/\D/g, '') || '';
            const userPhone = currentUser?.phone?.replace(/\D/g, '') || '';
            return driverPhone === userPhone;
          }
          return false;
        });
        
        setOrders(deliveryOrders);

        if (viewMode === 'selection') {
            const myActiveOrders = ordersResponse.orders.filter((o: Order) => {
                if (o.deliveryType !== 'delivery' || o.status !== 'out_for_delivery') return false;
                const driverPhone = o.driver?.phone?.replace(/\D/g, '') || '';
                const userPhone = currentUser?.phone?.replace(/\D/g, '') || '';
                return driverPhone === userPhone;
            });
            if (myActiveOrders.length > 0) setViewMode('route');
        }
      }

      if (sectorsResponse.success && sectorsResponse.sectors) {
        setSectors(sectorsResponse.sectors);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async () => {
    if (!currentUser) return;
    try {
      const response = await api.getDeliverymanHistory(currentUser.phone);
      if (response.success && response.history) {
        setHistoryOrders(response.history);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSectorSelection = (sectorId: string) => {
    setSelectedSectorIds(prev => {
        if (prev.includes(sectorId)) return prev.filter(id => id !== sectorId);
        return [...prev, sectorId];
    });
  };

  const startRoute = async () => {
    if (selectedSectorIds.length === 0) return;
    if (!confirm(`Confirmar início de rota com ${selectedSectorIds.length} setores?`)) return;

    setIsLoading(true);
    try {
        const ordersToTake = orders.filter(o => {
            const secId = o.deliverySector || 'other';
            return selectedSectorIds.includes(secId) && o.status === 'ready_for_delivery';
        });

        if (ordersToTake.length === 0) {
            alert('Não há pedidos disponíveis nestes setores.');
            return;
        }

        await Promise.all(ordersToTake.map(o => api.assignOrderToDriver(o.orderId, currentUser!)));
        setViewMode('route');
        setSelectedSectorIds([]);
        loadCurrentOrders();
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const finishRoute = async () => {
    if (orders.length === 0) {
      alert('Nenhum pedido para finalizar.');
      return;
    }
    if (!confirm(`Finalizar rota e confirmar entrega de TODOS os ${orders.length} pedidos?`)) return;
    setIsLoading(true);
    try {
        const results = await Promise.allSettled(
          orders.map(o => api.updateOrderStatus(o.orderId, 'completed'))
        );
        
        const failed = results.filter(r => r.status === 'rejected');
        const succeeded = results.filter(r => r.status === 'fulfilled');
        
        // Verificar respostas de sucesso (servidor pode retornar success: false)
        const serverErrors = succeeded.filter(r => {
          const val = (r as PromiseFulfilledResult<any>).value;
          return val && val.success === false;
        });
        
        const totalFailed = failed.length + serverErrors.length;
        const totalSuccess = orders.length - totalFailed;
        
        if (totalFailed > 0) {
          console.error('❌ [DELIVERYMAN] Falhas ao finalizar rota:', { failed: failed.length, serverErrors: serverErrors.length });
          alert(`⚠️ ${totalSuccess} entrega(s) finalizada(s), mas ${totalFailed} falharam. Tente novamente para as restantes.`);
        }
        
        if (totalSuccess > 0) {
          setViewMode('selection');
          setActiveTab('completed');
          // Carregar histórico para popular a aba de concluídos
          await loadHistory();
        }
        
        // Recarregar pedidos atuais (para limpar os finalizados)
        await loadCurrentOrders();
    } catch (e) {
        console.error('❌ [DELIVERYMAN] Erro ao finalizar rota:', e);
        alert('Erro ao finalizar rota. Verifique sua conexão e tente novamente.');
    } finally {
        setIsLoading(false);
    }
  };

  const markDelivered = async (orderId: string) => {
    if (!confirm('Confirmar entrega realizada?')) return;
    try {
      const res = await api.updateOrderStatus(orderId, 'completed');
      if (res && res.success === false) {
        console.error('❌ [DELIVERYMAN] Erro ao confirmar entrega:', res.error);
        alert('Erro ao confirmar entrega: ' + (res.error || 'Erro desconhecido'));
        return;
      }
      await loadCurrentOrders();
    } catch (e) {
      console.error('❌ [DELIVERYMAN] Erro ao finalizar entrega:', e);
      alert('Erro ao finalizar entrega. Verifique sua conexão.');
    }
  };

  const fmt = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

  const isToday = (dateString: string) => {
    const d = new Date(dateString);
    const today = new Date();
    
    // Lógica de "Dia de Negócio": subtrair 4 horas
    const businessD = new Date(d.getTime() - (4 * 60 * 60 * 1000));
    const businessToday = new Date(today.getTime() - (4 * 60 * 60 * 1000));
    
    return businessD.getDate() === businessToday.getDate() &&
           businessD.getMonth() === businessToday.getMonth() &&
           businessD.getFullYear() === businessToday.getFullYear();
  };

  if (!isLoggedIn) {
    if (availableColorsInfo.activeColors.length === 0) {
      return (
        <div className="min-h-screen bg-orange-50 dark:bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-zinc-800">
            <div className="text-center">
              <div className="bg-orange-100 dark:bg-orange-900/30 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Truck className="w-10 h-10 text-orange-600 dark:text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Área do Entregador</h1>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-900/40 rounded-lg p-6 mt-6">
                <p className="text-yellow-800 dark:text-yellow-400 font-bold text-lg mb-2">⚠️ Sistema não configurado</p>
                <p className="text-yellow-700 dark:text-yellow-500 text-sm">O administrador ainda não configurou este sistema.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-orange-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-zinc-800">
          <div className="text-center mb-8">
            <div className="bg-orange-100 dark:bg-orange-900/30 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Truck className="w-10 h-10 text-orange-600 dark:text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Área do Entregador</h1>
            <p className="text-gray-500 dark:text-gray-400">Identifique-se para começar</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(loginName, loginPhone, loginColor); }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Celular</label>
                <input
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Sua Cor do Dia</label>
                <div className="grid grid-cols-4 gap-2">
                  {availableColorsInfo.activeColors.map((color, idx) => {
                    const isUsed = availableColorsInfo.usedColors.includes(color);
                    const isSelected = loginColor === color;
                    return (
                      <button
                        key={`${color}-${idx}`}
                        type="button"
                        disabled={isUsed && !isSelected}
                        onClick={() => !isUsed && setLoginColor(color)}
                        className={`h-10 rounded-lg border-2 transition-all relative ${isSelected ? 'border-gray-800 dark:border-white scale-110 shadow-md' : 'border-transparent'} ${isUsed && !isSelected ? 'opacity-20 grayscale' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      >
                        {isSelected && <CheckCircle className="w-5 h-5 text-white mx-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading || !loginColor}
                className={`w-full text-white font-bold py-3 rounded-lg mt-4 transition-all ${!loginColor ? 'bg-gray-400 dark:bg-zinc-700' : 'hover:opacity-90'}`}
                style={{ backgroundColor: loginColor || '#9CA3AF' }}
              >
                {isLoading ? 'Entrando...' : 'Entrar e Começar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const ordersBySector: Record<string, Order[]> = {};
  orders.forEach(o => {
    const sec = o.deliverySector || 'other';
    if (!ordersBySector[sec]) ordersBySector[sec] = [];
    ordersBySector[sec].push(o);
  });

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 pb-20">
      {/* Header */}
      <div 
        className="text-white p-4 shadow-lg sticky top-0 z-10"
        style={{ backgroundColor: currentUser?.color }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full"><User className="w-6 h-6" /></div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{currentUser?.name}</h2>
              <p className="text-xs text-white/90">{currentUser?.phone}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-white/10 p-2 rounded-lg hover:bg-white/20 transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'current' && viewMode === 'route' && (
           <div className="mb-6 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-zinc-800 flex justify-between items-center">
             <div className="flex items-center gap-2">
               <Navigation className="w-5 h-5 text-blue-500 animate-pulse" />
               <span className="font-bold text-gray-800 dark:text-gray-100">Rota Ativa</span>
             </div>
             <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
               {orders.length} entregas
             </span>
           </div>
        )}

        {activeTab === 'current' ? (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhum pedido disponível.</p>
                <p className="text-sm opacity-60">Aguardando novos pedidos dos setores...</p>
              </div>
            ) : viewMode === 'selection' ? (
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest">Setores Selecionados</p>
                    <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{selectedSectorIds.length}</p>
                  </div>
                  <button 
                    onClick={startRoute} 
                    disabled={selectedSectorIds.length === 0 || isLoading} 
                    className={`px-8 py-4 rounded-xl font-black text-white shadow-xl transition-all flex items-center gap-2 ${selectedSectorIds.length === 0 ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'hover:scale-105 active:scale-95'}`}
                    style={{ backgroundColor: selectedSectorIds.length > 0 ? currentUser?.color : undefined }}
                  >
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                    INICIAR ROTA
                  </button>
                </div>

                {sectors.map(s => {
                  const sOrders = ordersBySector[s.id] || [];
                  if (sOrders.length === 0) return null;
                  const isS = selectedSectorIds.includes(s.id);
                  return (
                    <div key={s.id} className={`rounded-2xl border-2 transition-all ${isS ? 'border-gray-800 dark:border-white shadow-lg scale-[1.02]' : 'border-transparent bg-white dark:bg-zinc-900'}`}>
                      <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleSectorSelection(s.id)}>
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-12 rounded-full" style={{backgroundColor: s.color}} />
                          <div>
                            <h3 className="font-black text-gray-800 dark:text-gray-100 text-lg">{s.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">{sOrders.length} pedido{sOrders.length > 1 ? 's' : ''} pronto{sOrders.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isS ? 'bg-gray-800 dark:bg-white border-gray-800 dark:border-white' : 'border-gray-200 dark:border-zinc-800'}`}>
                          {isS && <CheckCircle className="w-5 h-5 text-white dark:text-zinc-900" />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {ordersBySector['other'] && (
                   <div key="other" className={`rounded-2xl border-2 transition-all ${selectedSectorIds.includes('other') ? 'border-gray-800 dark:border-white shadow-lg scale-[1.02]' : 'border-transparent bg-white dark:bg-zinc-900'}`}>
                    <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => toggleSectorSelection('other')}>
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-12 rounded-full bg-gray-400" />
                        <div>
                          <h3 className="font-black text-gray-800 dark:text-gray-100 text-lg">Sem Setor Definido</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">{ordersBySector['other'].length} pedidos</p>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selectedSectorIds.includes('other') ? 'bg-gray-800 dark:bg-white border-gray-800 dark:border-white' : 'border-gray-200 dark:border-zinc-800'}`}>
                        {selectedSectorIds.includes('other') && <CheckCircle className="w-5 h-5 text-white dark:text-zinc-900" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Suas Entregas em Mãos</h3>
                   <button 
                    onClick={finishRoute} 
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-transform active:scale-95"
                   >
                     FINALIZAR ROTA
                   </button>
                </div>
                {orders.map((o) => (
                  <div key={o.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-gray-100 dark:border-zinc-800 overflow-hidden">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 block">Pedido #{o.orderId}</span>
                          <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">{o.customerName}</h3>
                        </div>
                        <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-lg text-xs font-black">
                          {o.paymentMethod.toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 text-gray-600 dark:text-gray-400 mb-5">
                        <MapPin className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-base font-bold leading-tight tracking-tight">{o.address}</p>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                            Saída às {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-2xl font-black text-orange-600 dark:text-orange-500">{fmt(o.total)}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-zinc-800">
                      <a 
                        href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full bg-white dark:bg-zinc-900 py-4 font-black text-sm text-green-600 dark:text-green-500 flex items-center justify-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                      >
                        <Phone className="w-5 h-5" /> WHATSAPP
                      </a>
                    </div>
                    
                    <button 
                      onClick={() => markDelivered(o.orderId)} 
                      className="w-full bg-green-600 dark:bg-green-600 py-5 text-white font-black text-sm hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-3"
                    >
                      <CheckCircle className="w-6 h-6" /> CONFIRMAR ENTREGA
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'completed' ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-zinc-800 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <CheckCircle className="w-24 h-24" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-black tracking-[0.2em] mb-2">Entregas de Hoje</p>
                <p className="text-6xl font-black text-gray-800 dark:text-gray-100">
                    {historyOrders.filter(o => isToday(o.createdAt)).length}
                </p>
            </div>

            <div className="flex justify-between items-center px-2 mt-8">
                <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Recém Concluídas</h3>
            </div>

            {historyOrders.filter(o => isToday(o.createdAt)).length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">Nenhuma entrega hoje.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {historyOrders.filter(o => isToday(o.createdAt)).map((o) => (
                        <div key={o.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500" />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 dark:text-gray-100 text-lg">{o.customerName}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                                        Entregue às {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-gray-800 dark:text-gray-200 block">{fmt(o.total)}</span>
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500">#{o.orderId}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
             <div className="bg-gray-800 dark:bg-zinc-900 p-8 rounded-3xl shadow-xl text-white text-center mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Geral de Entregas</p>
                <p className="text-5xl font-black">{historyOrders.length}</p>
             </div>

             <div className="space-y-3">
                {historyOrders.length === 0 ? (
                    <div className="py-20 text-center text-gray-500">
                        <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="font-black">Histórico vazio.</p>
                    </div>
                ) : (
                    historyOrders.map((o) => (
                        <div key={o.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="text-gray-400">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-gray-100">{o.customerName}</h4>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                        {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-black text-gray-800 dark:text-gray-200 block">{fmt(o.total)}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">#{o.orderId}</span>
                            </div>
                        </div>
                    ))
                )}
             </div>
          </div>
        )}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 px-6 py-3 flex justify-around items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button 
              onClick={() => { setActiveTab('current'); setViewMode('selection'); }}
              className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${activeTab === 'current' ? 'scale-110' : 'text-gray-400 dark:text-gray-500 grayscale opacity-60'}`}
              style={{ color: activeTab === 'current' ? currentUser?.color : undefined }}
          >
              <Truck className={`w-7 h-7 ${activeTab === 'current' ? 'drop-shadow-sm' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-wider">Entregas</span>
          </button>
          
          <button 
              onClick={() => setActiveTab('completed')}
              className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${activeTab === 'completed' ? 'scale-110' : 'text-gray-400 dark:text-gray-500 grayscale opacity-60'}`}
              style={{ color: activeTab === 'completed' ? currentUser?.color : undefined }}
          >
              <CheckCircle className={`w-7 h-7 ${activeTab === 'completed' ? 'drop-shadow-sm' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-wider">Concluídos</span>
          </button>

          <button 
              onClick={() => setActiveTab('history')}
              className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${activeTab === 'history' ? 'scale-110' : 'text-gray-400 dark:text-gray-500 grayscale opacity-60'}`}
              style={{ color: activeTab === 'history' ? currentUser?.color : undefined }}
          >
              <History className={`w-7 h-7 ${activeTab === 'history' ? 'drop-shadow-sm' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-wider">Histórico</span>
          </button>
      </div>
    </div>
  );
}