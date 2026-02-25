import React, { useState } from 'react';
import { Star, X, MessageSquare, Send } from 'lucide-react';
import * as api from '../utils/api';
import { sanitizeText } from '../utils/sanitize';
import { useConfig } from '../ConfigContext';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onReviewSubmitted: (reviews: any[]) => void;
}

export function ReviewModal({ isOpen, onClose, order, onReviewSubmitted }: ReviewModalProps) {
  const { config } = useConfig();
  const themeColor = config.themeColor || '#d97706';
  
  const [ratings, setRatings] = useState<{ [key: string]: number }>({});
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !order) return null;

  const handleRating = (itemName: string, rating: number) => {
    setRatings(prev => ({ ...prev, [itemName]: rating }));
  };

  const handleComment = (itemName: string, comment: string) => {
    setComments(prev => ({ ...prev, [itemName]: comment }));
  };

  const handleSubmit = async () => {
    // Validar se todos os itens foram avaliados
    const allRated = order.items.every((item: any) => ratings[item.name] > 0);
    
    if (!allRated) {
      alert('Por favor, avalie todos os itens com pelo menos 1 estrela.');
      return;
    }

    setIsSubmitting(true);

    try {
      const reviews = order.items.map((item: any) => ({
        productName: item.name,
        rating: ratings[item.name],
        comment: sanitizeText(comments[item.name] || '', 500)
      }));

      const response = await api.submitOrderReview(order.orderId, reviews);

      if (response.success) {
        // Sucesso: Mostrar estado de sucesso
        setIsSuccess(true);
        onReviewSubmitted(reviews); // Notificar pai
        
        // Fechar automaticamente após 3 segundos
        setTimeout(() => {
           onClose();
           setIsSuccess(false); // Resetar para próxima vez
        }, 3000);
      } else {
        alert('Erro ao enviar avaliação: ' + response.error);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao enviar avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center animate-in fade-in zoom-in-95 duration-300">
           <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Star className="w-10 h-10 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />
           </div>
           <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Avaliação Concluída!</h2>
           <p className="text-gray-600 dark:text-gray-300">Obrigado por nos avaliar. Sua opinião é fundamental para melhorarmos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div 
          className="p-4 flex items-center justify-between text-white"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 fill-white" />
            <h2 className="font-bold text-lg">Avaliar Pedido #{order.orderId}</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-gray-600 dark:text-gray-300 text-sm text-center">
            Sua opinião é muito importante para nós! Avalie os itens que você consumiu:
          </p>

          {order.items.map((item: any, idx: number) => (
            <div key={idx} className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 border border-gray-100 dark:border-zinc-700">
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-gray-800 dark:text-gray-100">{item.quantity}x {item.name}</span>
              </div>

              {/* Estrelas */}
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(item.name, star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        (ratings[item.name] || 0) >= star 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300 dark:text-gray-600'
                      }`} 
                    />
                  </button>
                ))}
              </div>

              {/* Comentário */}
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-gray-400 absolute top-3 left-3" />
                <textarea
                  placeholder="Deixe um comentário (opcional)..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none bg-white dark:bg-zinc-900 dark:text-white"
                  rows={2}
                  value={comments[item.name] || ''}
                  onChange={(e) => handleComment(item.name, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeColor }}
          >
            {isSubmitting ? (
              'Enviando...'
            ) : (
              <>
                <Send className="w-5 h-5" />
                Enviar Avaliação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}