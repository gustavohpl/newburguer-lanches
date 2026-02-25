import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, Package, Truck, X, XCircle, ChevronLeft, Star } from 'lucide-react';
import * as api from '../utils/api';
import { ReviewModal } from './ReviewModal';
import { useConfig } from '../ConfigContext';

export interface OrderStatus {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  deliverySector?: string; // 🆕 Adicionado setor
  paymentMethod?: string; // 🆕 Adicionado método
  cardType?: 'credit' | 'debit'; // 🆕 Adicionado tipo de cartão
  changeFor?: number; // 🆕 Adicionado troco
  status: 'pending' | 'preparing' | 'packing' | 'ready_for_delivery' | 'out_for_delivery' | 'ready_for_pickup' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  reviews?: Array<{ productName: string, rating: number, comment: string }>; // Adicionado campo de reviews
}

interface OrderTrackingProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export function OrderTracking({ isOpen, onClose, orderId }: OrderTrackingProps) {
  const { config } = useConfig();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [estimates, setEstimates] = useState<api.TimeEstimates | null>(null);
  const [sectors, setSectors] = useState<any[]>([]); // 🆕 Estado para nomes dos setores
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const isLoadingRef = useRef(false); // 🆕 useRef para evitar re-renders e múltiplas requisições

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrder();
      loadEstimates();
      loadSectors(); // 🆕 Carregar setores para traduzir ID em nome
      setShowThankYouMessage(false);
      
      // Atualizar status a cada 5 segundos (reduzido de 1s para evitar sobrecarga)
      const interval = setInterval(() => {
        // 🆕 Só fazer polling se não estiver carregando
        if (!isLoadingRef.current) {
          loadOrder();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, orderId]);

  const loadEstimates = async () => {
    try {
      const response = await api.getEstimates();
      if (response.success && response.estimates) {
        setEstimates(response.estimates);
      }
    } catch (error) {
      console.error('Erro ao carregar estimativas:', error);
    }
  };

  const loadSectors = async () => {
    try {
      const response = await api.getDeliverySectors();
      if (response.success && response.sectors) {
        setSectors(response.sectors);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const getEstimateForType = (type: 'delivery' | 'pickup' | 'dine-in') => {
    if (!estimates) return null;
    switch (type) {
      case 'delivery': return estimates.delivery;
      case 'pickup': return estimates.pickup;
      case 'dine-in': return estimates.dineIn;
      default: return null;
    }
  };

  const loadOrder = async () => {
    // 🆕 Prevenir múltiplas requisições simultâneas
    if (isLoadingRef.current) {
      console.log('⏸️ [ORDER TRACKING] Requisição já em andamento, pulando...');
      return;
    }

    try {
      isLoadingRef.current = true; // 🆕 Marcar como "carregando"
      console.log('🔄 [ORDER TRACKING] ===== INICIANDO CARREGAMENTO =====');
      console.log('🔄 [ORDER TRACKING] Order ID:', orderId);
      console.log('🔄 [ORDER TRACKING] Estado atual do order:', order);
      
      // 🔥 CORREÇÃO: Só mostrar loading na primeira vez, não nas atualizações automáticas
      const isFirstLoad = !order;
      console.log('🔄 [ORDER TRACKING] É primeira carga?', isFirstLoad);
      
      if (isFirstLoad) {
        console.log('⏳ [ORDER TRACKING] Setando isLoading = true');
        setIsLoading(true);
      }
      setError('');
      
      console.log('📡 [ORDER TRACKING] Chamando api.getOrder...');
      const response = await api.getOrder(orderId);
      console.log('📡 [ORDER TRACKING] Resposta recebida:', response);
      
      if (response.success && response.order) {
        console.log('✅ [ORDER TRACKING] Pedido encontrado!');
        const orderData = {
          ...response.order,
          createdAt: new Date(response.order.createdAt),
          updatedAt: new Date(response.order.updatedAt),
        };
        
        console.log('📦 [ORDER TRACKING] Dados processados:', orderData);
        setOrder(orderData);
        
        // 💾 ATUALIZAR STATUS NO HISTÓRICO LOCAL
        updateLocalOrderStatus(orderId, response.order.status);
        
        // Só desligar loading se foi a primeira carga
        if (isFirstLoad) {
          console.log('✅ [ORDER TRACKING] Setando isLoading = false (primeira carga completa)');
          setIsLoading(false);
        }
      } else {
        console.error('❌ [ORDER TRACKING] Pedido não encontrado na resposta');
        console.error('❌ [ORDER TRACKING] Response:', JSON.stringify(response, null, 2));
        setError('Pedido não encontrado');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('❌ [ORDER TRACKING] ERRO CAPTURADO:', err);
      console.error('❌ [ORDER TRACKING] Stack:', err instanceof Error ? err.stack : 'N/A');
      setError('Erro ao carregar dados do pedido');
      setIsLoading(false);
    } finally {
      isLoadingRef.current = false; // 🆕 Liberar flag
      console.log('🔄 [ORDER TRACKING] ===== FIM DO CARREGAMENTO =====');
    }
  };

  // Atualizar status do pedido no histórico local do dispositivo
  const updateLocalOrderStatus = (orderId: string, newStatus: string) => {
    try {
      const historyKey = 'faroeste_my_orders';
      const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      
      // Encontrar e atualizar o pedido
      const updatedHistory = currentHistory.map((order: any) =>
        order.orderId === orderId ? { ...order, status: newStatus } : order
      );
      
      // Salvar histórico atualizado
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
      console.log('💾 [HISTÓRICO] Status do pedido atualizado:', { orderId, newStatus });
    } catch (error) {
      console.error('❌ [HISTÓRICO] Erro ao atualizar status:', error);
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="bg-red-100 dark:bg-red-900/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Erro</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error || 'Pedido não encontrado'}</p>
            <button
              onClick={onClose}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusSteps = order.deliveryType === 'delivery' 
    ? [
        { key: 'pending', label: 'Pedido Recebido', icon: Clock },
        { key: 'preparing', label: 'Preparando', icon: Clock },
        { key: 'packing', label: 'Embalando', icon: Package },
        { key: 'ready_for_delivery', label: 'Pronto para Entrega', icon: Truck },
        { key: 'out_for_delivery', label: 'Saiu para Entrega', icon: Truck },
        { key: 'completed', label: 'Entregue', icon: CheckCircle }
      ]
    : [
        { key: 'pending', label: 'Pedido Recebido', icon: Clock },
        { key: 'preparing', label: 'Preparando', icon: Clock },
        { key: 'ready_for_pickup', label: 'Pronto para Retirada', icon: Package },
        { key: 'completed', label: 'Retirado', icon: CheckCircle }
      ];

  // Adicionar status "Cancelado" se o pedido foi cancelado
  if (order.status === 'cancelled') {
    statusSteps.push({ key: 'cancelled', label: 'Cancelado', icon: XCircle });
  }

  const currentStepIndex = statusSteps.findIndex(step => step.key === order.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Acompanhar Pedido</h2>
              <p className="text-amber-100">Pedido #{order.orderId}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-amber-800 p-2 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Informações do Pedido */}
          <div className="mb-8 bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Informações do Pedido</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Cliente:</span> {order.customerName}</p>
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Telefone:</span> {order.customerPhone}</p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Tipo:</span> {
                  order.deliveryType === 'delivery' 
                    ? 'Entrega' 
                    : order.deliveryType === 'dine-in'
                    ? 'Consumir no Local'
                    : 'Retirada'
                }
              </p>
              {order.address && (
                <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Endereço:</span> {order.address}</p>
              )}
              {order.deliveryType === 'delivery' && order.deliverySector && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Setor:</span> {sectors.find(s => s.id === order.deliverySector)?.name || 'Carregando...'}
                </p>
              )}
              {order.paymentMethod === 'card' && order.cardType && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Pagamento:</span> Cartão ({order.cardType === 'credit' ? 'Crédito' : 'Débito'})
                </p>
              )}
              {order.paymentMethod === 'cash' && order.changeFor && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Troco:</span> R$ {order.changeFor.toFixed(2)}
                </p>
              )}
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Total:</span> R$ {order.total.toFixed(2)}</p>
            </div>
          </div>

          {/* Estimativa de Tempo */}
          {getEstimateForType(order.deliveryType) && order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-800 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 text-white rounded-full p-2">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Tempo Estimado</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    {(() => {
                      const est = getEstimateForType(order.deliveryType);
                      return est && typeof est === 'object' && 'min' in est && 'max' in est 
                        ? `~${est.min}-${est.max} min` 
                        : '~30-40 min';
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-6">Status do Pedido</h3>
            <div className="space-y-4">
              {statusSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isCancelled = step.key === 'cancelled';

                return (
                  <div key={step.key} className="flex items-start gap-4">
                    {/* Ícone */}
                    <div className="relative">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          isCancelled
                            ? 'bg-red-500 text-white shadow-lg ring-4 ring-red-200'
                            : isCompleted
                            ? 'bg-green-500 text-white shadow-lg'
                            : 'bg-gray-200 text-gray-400'
                        } ${isCurrent && !isCancelled ? 'ring-4 ring-green-200 scale-110' : ''}`}
                      >
                        <StepIcon className="w-6 h-6" />
                      </div>
                      {/* Linha conectora */}
                      {index < statusSteps.length - 1 && (
                        <div
                          className={`absolute left-1/2 top-12 w-0.5 h-8 -ml-px transition-colors ${
                            index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>

                    {/* Texto */}
                    <div className="flex-1 pt-2">
                      <p
                        className={`font-medium transition-colors ${
                          isCancelled
                            ? 'text-red-600 dark:text-red-400 font-bold'
                            : isCompleted 
                            ? 'text-gray-800 dark:text-gray-100' 
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && !isCancelled && (
                        <p className="text-sm text-green-600 mt-1 animate-pulse">
                          Status atual
                        </p>
                      )}
                      {isCancelled && (
                        <p className="text-sm text-red-600 mt-1 font-semibold">
                          ⚠️ Pedido cancelado pelo estabelecimento
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Itens do Pedido */}
          <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Itens do Pedido</h3>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-gray-800 dark:text-gray-100 font-medium">
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-300 dark:border-zinc-700 pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-800 dark:text-gray-100">Total</span>
                  <span className="text-green-600 dark:text-green-400">R$ {order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mensagem de Agradecimento (Pós-Avaliação imediata) */}
          {showThankYouMessage && (
             <div className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center animate-in fade-in zoom-in duration-300 shadow-sm">
               <div className="bg-green-100 dark:bg-green-900/40 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                 <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
               </div>
               <h3 className="text-xl font-bold text-green-800 dark:text-green-100 mb-1">Avaliação Enviada!</h3>
               <p className="text-green-700 dark:text-green-200">Obrigado pelo seu feedback. Ele é muito importante para nós! ⭐</p>
             </div>
          )}

          {/* Botão de Avaliação (Apenas se concluído, não avaliado e funcionalidade ativada) */}
          {config.features?.reviews !== false && order.status === 'completed' && (!order.reviews || order.reviews.length === 0) && !showThankYouMessage && (
            <div className="mt-6">
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 animate-bounce"
              >
                <Star className="w-5 h-5 fill-current" />
                Avaliar Pedido
              </button>
            </div>
          )}

          {/* Se já foi avaliado (Histórico) - Apenas se funcionalidade ativada */}
          {config.features?.reviews !== false && order.status === 'completed' && order.reviews && order.reviews.length > 0 && !showThankYouMessage && (
             <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-center">
               <p className="text-yellow-800 dark:text-yellow-100 font-bold flex items-center justify-center gap-2">
                 <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                 Pedido Avaliado!
               </p>
               <p className="text-sm text-yellow-700 dark:text-yellow-200">Obrigado pelo seu feedback.</p>
             </div>
          )}

          {/* Mensagem de ajuda */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 Esta página é atualizada automaticamente. Você pode acompanhar seu pedido em tempo real!
            </p>
          </div>
        </div>
      </div>
      
      {/* Modal de Avaliação */}
      <ReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        order={order}
        onReviewSubmitted={(reviews) => {
          console.log('✅ [REVIEW] Avaliação recebida:', reviews);
          
          // Atualização Otimista do estado local
          if (order) {
            const updatedOrder = { ...order, reviews: reviews };
            setOrder(updatedOrder);
            
            // 💾 ATUALIZAR NO HISTÓRICO LOCAL
            try {
              const historyKey = 'faroeste_my_orders';
              const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
              
              // Encontrar e atualizar o pedido com as reviews
              const updatedHistory = currentHistory.map((o: any) =>
                o.orderId === order.orderId ? { ...o, reviews: reviews } : o
              );
              
              // Salvar histórico atualizado
              localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
              console.log('💾 [HISTÓRICO] Reviews salvas localmente:', { orderId: order.orderId, reviews });
            } catch (error) {
              console.error('❌ [HISTÓRICO] Erro ao atualizar reviews:', error);
            }
          }
          
          setShowThankYouMessage(true);
          setIsReviewModalOpen(false);
          
          // Recarregar do servidor em background (sem bloquear UI)
          setTimeout(() => {
            loadOrder();
          }, 500);
        }}
      />
    </div>
  );
}