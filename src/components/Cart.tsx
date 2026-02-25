import React from "react";
import type { CartItem } from "../App";
import { getCategoryEmoji } from "../utils/api";
import { useI18n } from '../hooks/useI18n';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  totalPrice: number;
  onCheckout: () => void;
}

export function Cart({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  totalPrice,
  onCheckout
}: CartProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center gap-4 shadow-lg">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 shadow-md hover:shadow-lg transition-all flex items-center justify-center hover:scale-105 text-white text-xl font-bold"
            >
              ←
            </button>
            <h2 className="text-xl font-bold text-white flex-1 text-center mr-10 drop-shadow-lg">
              {t('cart.title')}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-lg">{t('cart.empty')}</p>
                <p className="text-sm mt-2">{t('products.addToCart')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all border border-gray-100 dark:border-zinc-700"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-zinc-700">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">
                            {getCategoryEmoji(item.category) || '🍔'}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-1 truncate">
                          {item.name}
                        </h3>

                        {item.notes && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1 mb-2">
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              <span className="font-medium">Obs:</span> {item.notes}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-2 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <span>🍽️</span>
                            <span>15min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>⏱️</span>
                            <span>Pronto</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="text-amber-600 dark:text-amber-500 font-bold text-lg">
                            R${(item.price * item.quantity).toFixed(2).replace(".", ",")}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all font-bold text-xl"
                            >
                              −
                            </button>
                            
                            <span className="w-8 text-center font-bold text-gray-700 dark:text-white">
                              {item.quantity}
                            </span>
                            
                            <button
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all font-bold text-xl"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="px-6 py-4 border-t-2 border-gray-100 dark:border-zinc-800">
              <button
                onClick={onCheckout}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
              >
                Pagar R${totalPrice.toFixed(2).replace(".", ",")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}