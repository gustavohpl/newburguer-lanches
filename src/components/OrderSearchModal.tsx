import React, { useState, useEffect } from 'react';
import { Search, X, Package, ChevronLeft, Clock, MapPin, Phone, User, ChevronRight, Star } from 'lucide-react';
import * as api from '../utils/api';
import { ReviewModal } from './ReviewModal';
import { useConfig } from '../ConfigContext';

interface LocalOrder {
  orderId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  status: string;
  createdAt: string;
  itemCount: number;
  reviews?: Array<{ productName: string; rating: number; comment: string }>; // Adicionar campo reviews
  reviewedAt?: string; // Adicionar campo reviewedAt
}

interface OrderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderFound: (orderId: string) => void;
}

export function OrderSearchModal({ isOpen, onClose, onOrderFound }: OrderSearchModalProps) {
  const { config } = useConfig();
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [localOrders, setLocalOrders] = useState<LocalOrder[]>([]);
  const [searchMode, setSearchMode] = useState(false);
  
  // Estado para avaliação
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [orderToReview, setOrderToReview] = useState<any>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Carregar pedidos do localStorage quando abrir o modal e sincronizar status
  useEffect(() => {
    if (isOpen) {
      loadLocalOrders();
      setSearchMode(false);
    }
  }, [isOpen]);

  // Polling: re-sincronizar a cada 10s enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const stored = localStorage.getItem('faroeste_my_orders');
      if (stored) {
        try {
          const orders = JSON.parse(stored).sort((a: LocalOrder, b: LocalOrder) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          // Sincronizar apenas pedidos não-finais
          const activeOrders = orders.filter((o: LocalOrder) => 
            o.status !== 'completed' && o.status !== 'cancelled'
          ).slice(0, 10);
          if (activeOrders.length > 0) {
            syncOrdersStatus(orders, activeOrders);
          }
        } catch {}
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const loadLocalOrders = async () => {
    try {
      const stored = localStorage.getItem('faroeste_my_orders');
      if (stored) {
        let orders = JSON.parse(stored);
        
        // Ordenar: mais recentes primeiro
        orders = orders.sort((a: LocalOrder, b: LocalOrder) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setLocalOrders(orders);
        
        if (orders.length > 0) {
          setSearchMode(false);
          syncOrdersStatus(orders, orders.slice(0, 10));
        } else {
          setSearchMode(true);
        }
      } else {
        setSearchMode(true);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar histórico de pedidos:', error);
      setSearchMode(true);
    }
  };

  // Função para sincronizar status com o servidor
  // Recebe a lista completa (allOrders) e os pedidos a verificar (ordersToCheck)
  const syncOrdersStatus = async (allOrders: LocalOrder[], ordersToCheck: LocalOrder[]) => {
    console.log('🔄 [SYNC] Sincronizando status dos pedidos...', ordersToCheck.length);
    let hasUpdates = false;
    const updatedOrdersList = [...allOrders];

    for (const localOrder of ordersToCheck) {
      try {
        const response = await api.getOrder(localOrder.orderId);
        
        if (response.success && response.order) {
           const serverStatus = response.order.status;
           const serverReviews = response.order.reviews;
           const serverReviewedAt = response.order.reviewedAt;
           
           if (serverStatus !== localOrder.status || 
               (serverReviews && serverReviews.length > 0 && !localOrder.reviews)) {
             console.log(`📝 [SYNC] ${localOrder.orderId}: ${localOrder.status} → ${serverStatus}`);
             const index = updatedOrdersList.findIndex(o => o.orderId === localOrder.orderId);
             if (index !== -1) {
               updatedOrdersList[index] = { 
                 ...updatedOrdersList[index], 
                 status: serverStatus,
                 reviews: serverReviews,
                 reviewedAt: serverReviewedAt
               };
               hasUpdates = true;
             }
           }
        }
      } catch (err) {
        console.debug(`🔇 [SYNC] Erro ao sincronizar ${localOrder.orderId}:`, err);
      }
    }

    if (hasUpdates) {
      setLocalOrders(updatedOrdersList);
      localStorage.setItem('faroeste_my_orders', JSON.stringify(updatedOrdersList));
      console.log('✅ [SYNC] Status atualizado!');
    }
  };

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!orderId.trim() && !phone.trim()) {
      setError('Digite o número do pedido ou telefone');
      return;
    }

    try {
      setError('');
      
      if (orderId.trim()) {
        // Buscar por ID do pedido
        const response = await api.getOrder(orderId.trim());
        
        if (response.success && response.order) {
          onOrderFound(orderId.trim());
          handleClose();
        } else {
          setError('Pedido não encontrado. Verifique o número e tente novamente.');
        }
      } else if (phone.trim()) {
        // Buscar por telefone
        const cleanPhone = phone.replace(/\D/g, '');
        const response = await api.searchOrdersByPhone(cleanPhone);
        
        if (response.success && response.orders && response.orders.length > 0) {
          // Pegar o pedido mais recente
          const latestOrder = response.orders[0];
          onOrderFound(latestOrder.orderId);
          handleClose();
        } else {
          setError('Nenhum pedido encontrado com este telefone.');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      setError('Erro ao buscar pedido. Tente novamente.');
    }
  };

  const handleClose = () => {
    setOrderId('');
    setPhone('');
    setError('');
    onClose();
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const handleOrderClick = (orderId: string) => {
    onOrderFound(orderId);
    handleClose();
  };

  const handleReviewClick = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation(); // Evitar abrir o tracking ao clicar em avaliar
    setIsLoadingReview(true);
    try {
      const response = await api.getOrder(orderId);
      if (response.success && response.order) {
        // Verificar se já foi avaliado
        if (response.order.reviews && response.order.reviews.length > 0) {
          alert('Este pedido já foi avaliado. Obrigado!');
        } else {
          setOrderToReview(response.order);
          setReviewModalOpen(true);
        }
      } else {
        alert('Erro ao carregar detalhes do pedido para avaliação.');
      }
    } catch (error) {
      console.error('Erro ao buscar pedido para review:', error);
      alert('Erro de conexão.');
    } finally {
      setIsLoadingReview(false);
    }
  };

  const getDeliveryTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery': return '🚚 Entrega';
      case 'pickup': return '🏪 Retirada';
      case 'dine-in': return '🍽️ No Local';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-2 py-1 rounded">Aguardando</span>;
      case 'preparing':
        return <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-2 py-1 rounded">Preparando</span>;
      case 'packing':
        return <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 px-2 py-1 rounded">Embalando</span>;
      case 'ready_for_delivery':
        return <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 px-2 py-1 rounded">Pronto p/ Entrega</span>;
      case 'out_for_delivery':
        return <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 px-2 py-1 rounded">Em Rota</span>;
      case 'ready_for_pickup':
        return <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-2 py-1 rounded">Pronto</span>;
      case 'completed':
        return <span className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-300 px-2 py-1 rounded">Concluído</span>;
      case 'cancelled':
        return <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-2 py-1 rounded">Cancelado</span>;
      default:
        return <span className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-300 px-2 py-1 rounded">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    // Ajuste de "Dia de Negócio" (4h da manhã)
    const getBusinessDate = (d: Date) => new Date(d.getTime() - (4 * 60 * 60 * 1000));
    
    const businessDate = getBusinessDate(date);
    const businessToday = getBusinessDate(today);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const businessYesterday = getBusinessDate(yesterday);

    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Verificar se é o mesmo dia de negócio que hoje
    if (businessDate.toDateString() === businessToday.toDateString()) {
      return `Hoje às ${timeStr}`;
    }
    
    // Verificar se foi o dia de negócio de ontem
    if (businessDate.toDateString() === businessYesterday.toDateString()) {
      return `Ontem às ${timeStr}`;
    }

    return `${dateStr} às ${timeStr}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 rounded-t-lg flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Acompanhar Pedido</h2>
            <button
              onClick={handleClose}
              className="text-white hover:bg-amber-800 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Lista de Pedidos (Padrão se tiver histórico) */}
          {!searchMode && localOrders.length > 0 ? (
            <div className="flex flex-col h-full">
               <div className="mb-4 pb-4 border-b border-gray-200 dark:border-zinc-800">
                 <div className="relative">
                   <input
                     type="text"
                     value={orderId}
                     onChange={(e) => {
                       const val = e.target.value.toUpperCase();
                       setOrderId(val);
                       setError('');
                     }}
                     onKeyPress={(e) => {
                       if (e.key === 'Enter' && orderId.trim()) {
                         handleSearch();
                       }
                     }}
                     placeholder="Buscar outro pedido (ex: FH-123)..."
                     className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white dark:bg-zinc-800 dark:text-white"
                   />
                   <button
                     onClick={handleSearch}
                     disabled={!orderId.trim()}
                     className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                     <Search className="w-4 h-4" />
                   </button>
                 </div>
                 {error && (
                   <p className="text-xs text-red-600 mt-1">{error}</p>
                 )}
               </div>

               <div className="mb-4">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
                    <Clock className="w-5 h-5 text-amber-600" />
                    Seus Pedidos Recentes
                 </h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400">Selecione um pedido para ver detalhes</p>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                 {localOrders.map(order => (
                   <div
                     key={order.orderId}
                     onClick={() => handleOrderClick(order.orderId)}
                     className="bg-white dark:bg-zinc-800 border-2 border-gray-100 dark:border-zinc-700 rounded-lg p-4 cursor-pointer hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all shadow-sm"
                   >
                     <div className="flex items-start justify-between mb-2">
                       <div>
                         <div className="font-bold text-gray-800 dark:text-white text-lg">#{order.orderId}</div>
                         <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</div>
                       </div>
                       {getStatusBadge(order.status)}
                     </div>
                     
                     <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{order.itemCount} itens</span>
                        <div className="flex items-center gap-3">
                          {config.features?.reviews !== false && order.status === 'completed' && (
                            <>
                              {order.reviews && order.reviews.length > 0 ? (
                                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold flex items-center gap-1 border border-green-200 dark:border-green-800">
                                  <Star className="w-3 h-3 fill-green-500 text-green-500" />
                                  Avaliado
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => handleReviewClick(e, order.orderId)}
                                  disabled={isLoadingReview}
                                  className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 rounded-full text-xs font-bold flex items-center gap-1 transition-colors border border-yellow-200 dark:border-yellow-800"
                                >
                                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                  Avaliar
                                </button>
                              )}
                            </>
                          )}
                          <span className="font-bold text-green-600 dark:text-green-500">R$ {order.total.toFixed(2)}</span>
                        </div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          ) : (
             <div className="space-y-4 pt-4">
               {localOrders.length > 0 && (
                 <button 
                   onClick={() => setSearchMode(false)}
                   className="mb-4 flex items-center text-amber-600 dark:text-amber-500 font-medium text-sm hover:underline"
                 >
                   <ChevronLeft className="w-4 h-4" /> Voltar para meus pedidos
                 </button>
               )}
             
               <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 Digite o código do pedido que você recebeu.
                </p>
               </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Número do Pedido ou Telefone
                  </label>
                  <input
                    type="text"
                    value={orderId || phone}
                    onChange={(e) => {
                       const val = e.target.value;
                       if (val.match(/^\d/)) {
                         setPhone(formatPhone(val));
                         setOrderId('');
                       } else {
                         setOrderId(val.toUpperCase());
                         setPhone('');
                       }
                       setError('');
                    }}
                    placeholder="Ex: FH-123 ou (64)..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900">{error}</p>
                )}

                <button
                  onClick={handleSearch}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Buscar
                </button>
             </div>
          )}
        </div>
      </div>
      
      {reviewModalOpen && orderToReview && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setOrderToReview(null);
          }}
          order={orderToReview}
          onReviewSubmitted={(reviews) => {
            console.log('✅ [ORDER SEARCH] Avaliação recebida, atualizando interface...');
            const updatedOrders = localOrders.map(order => {
              if (order.orderId === orderToReview.orderId) {
                return {
                  ...order,
                  reviews: reviews,
                  reviewedAt: new Date().toISOString()
                };
              }
              return order;
            });
            setLocalOrders(updatedOrders);
            localStorage.setItem('faroeste_my_orders', JSON.stringify(updatedOrders));
          }}
        />
      )}
    </div>
  );
}
