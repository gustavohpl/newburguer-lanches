import React from 'react';
import { CheckCircle, Search, Clock, X, Phone } from 'lucide-react';
import { useConfig } from '../ConfigContext';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: { orderId: string; total: number; phone?: string } | null;
}

export function OrderSuccessModal({ isOpen, onClose, orderData }: OrderSuccessModalProps) {
  const { config } = useConfig();
  console.log('🎉 [SUCCESS MODAL] Renderizando modal');
  console.log('🎉 [SUCCESS MODAL] isOpen:', isOpen);
  console.log('🎉 [SUCCESS MODAL] orderData:', orderData);
  
  if (!isOpen || !orderData) {
    console.log('🎉 [SUCCESS MODAL] Modal não será exibido - isOpen:', isOpen, 'orderData:', orderData);
    return null;
  }

  const handleTrackOrder = () => {
    onClose();
    // Scroll para o topo e focar no campo de busca
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      const searchButton = document.querySelector('[aria-label="Acompanhar Pedido"]') as HTMLElement;
      if (searchButton) {
        searchButton.click();
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto overflow-hidden animate-bounce-in">
        {/* Header com ícone de sucesso */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-white dark:bg-zinc-900 rounded-full p-2 animate-scale-in">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Pedido Confirmado! 🎉</h2>
          <p className="text-green-100 text-sm mt-1">Seu pedido foi enviado com sucesso</p>
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-3">
          {/* Informações do Pedido */}
          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Número do Pedido:</span>
              <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">{orderData.orderId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Valor Total:</span>
              <span className="text-lg font-bold text-green-700 dark:text-green-400">
                R$ {orderData.total.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">
                  📱 Próximos Passos:
                </p>
                <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5 list-decimal list-inside">
                  <li>Aguarde confirmação pelo WhatsApp</li>
                  {config.features?.orderTracking !== false && <li>Acompanhe o status em tempo real</li>}
                  <li>Você será notificado quando estiver pronto!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Destaque - Acompanhamento (Apenas se ativado) */}
          {(config.features?.orderTracking !== false) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-800 rounded-lg p-3 text-center">
              <p className="text-amber-900 dark:text-amber-100 font-bold mb-1 text-xs">
                🔍 Acompanhe seu Pedido
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                Use o número <span className="font-mono font-bold">{orderData.orderId}</span> ou telefone
                {orderData.phone && (
                  <span className="font-mono font-bold ml-1">{orderData.phone}</span>
                )}
              </p>
              <button
                onClick={handleTrackOrder}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg font-bold text-sm transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Acompanhar Meu Pedido
              </button>
            </div>
          )}

          {/* Mensagem de Agradecimento */}
          <div className="text-center pt-1">
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              Obrigado por escolher o <span className="font-bold text-amber-700 dark:text-amber-500">NewBurguer Lanches</span>! 🍔
            </p>
          </div>

          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="w-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Fechar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.6s ease-out 0.2s both;
        }
      `}</style>
    </div>
  );
}