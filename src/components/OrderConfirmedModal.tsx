import React, { useEffect, useState } from 'react';
import { CheckCircle, X, Clock, MapPin, Phone } from 'lucide-react';

interface OrderConfirmedModalProps {
  orderId: string;
  customerName: string;
  total: number;
  estimatedTime: number | { min: number; max: number };
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  onClose: () => void;
}

export function OrderConfirmedModal({
  orderId,
  customerName,
  total,
  estimatedTime,
  deliveryType,
  address,
  onClose,
  enableTracking = true
}: OrderConfirmedModalProps & { enableTracking?: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    console.log('🎉🎉🎉 [MODAL CONFIRMADO] Componente renderizado!', {
      orderId,
      customerName,
      total,
      estimatedTime,
      deliveryType,
      address
    });
    
    // Animação de entrada
    setTimeout(() => setShow(true), 100);
  }, []);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 300);
  };

  const getDeliveryTypeLabel = () => {
    switch (deliveryType) {
      case 'delivery':
        return 'Entrega';
      case 'pickup':
        return 'Retirada';
      case 'dine-in':
        return 'Consumir no Local';
      default:
        return deliveryType;
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        show ? 'bg-black bg-opacity-50' : 'bg-black bg-opacity-0'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative transform transition-all duration-300 ${
          show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão X no canto — fixo dentro do modal */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-20 text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header com animação de sucesso */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 sm:p-8 rounded-t-2xl text-white text-center relative overflow-hidden">
          {/* Efeito de confete animado */}
          <div className="absolute inset-0 opacity-20">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 animate-bounce">
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 dark:text-green-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">🎉 Pedido Confirmado!</h2>
            <p className="text-green-100 dark:text-green-200 text-base sm:text-lg">Pagamento aceito com sucesso</p>
          </div>
        </div>

        {/* Corpo do modal */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Informações do pedido */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Pedido</span>
              <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">#{orderId}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Cliente</span>
              <span className="font-semibold text-gray-900 dark:text-white">{customerName}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Tipo</span>
              <span className="font-semibold text-gray-900 dark:text-white">{getDeliveryTypeLabel()}</span>
            </div>

            {address && (
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
                <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{address}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-zinc-700">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Total</span>
              <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-500">
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Status atual */}
          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-full p-2 flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-900 dark:text-green-400">Seu pedido está sendo preparado!</h3>
                <p className="text-sm text-green-700 dark:text-green-500">
                  Tempo estimado: <span className="font-bold">
                    {typeof estimatedTime === 'object' && 'min' in estimatedTime 
                      ? `${estimatedTime.min}-${estimatedTime.max} minutos` 
                      : `${estimatedTime} minutos`}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Mensagem */}
          {enableTracking && (
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-1 text-sm">
                Você pode acompanhar o status do seu pedido em
              </p>
              <p className="text-amber-600 dark:text-amber-500 font-bold text-lg uppercase tracking-tight">
                "Pedidos"
              </p>
            </div>
          )}

          {/* Botão de fechar */}
          <button
            onClick={handleClose}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Entendido
          </button>

          {/* Link de suporte */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 pb-1">
            Dúvidas? Entre em contato conosco
          </div>
        </div>
      </div>
    </div>
  );
}