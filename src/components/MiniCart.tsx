import React, { useState } from 'react';
import { ShoppingBag, X, ChevronRight, ChevronLeft, Plus, Minus } from 'lucide-react';
import type { CartItem } from '../App';
import { getCategoryEmoji } from '../utils/api';

interface MiniCartProps {
  items: CartItem[];
  totalPrice: number;
  onOpenFullCart: () => void;
  onRemove: (productId: string) => void;
  onUpdateQuantity?: (productId: string, quantity: number) => void;
}

export function MiniCart({ items, totalPrice, onOpenFullCart, onRemove, onUpdateQuantity }: MiniCartProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Não mostrar se o carrinho estiver vazio
  if (items.length === 0) return null;

  return (
    <>
      {/* Sacola flutuante - Sempre visível */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-full shadow-2xl hover:shadow-amber-500/50 flex items-center justify-center transition-all transform hover:scale-110 group"
      >
        {/* Badge de quantidade */}
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <span className="text-white font-bold text-sm">{totalItems}</span>
        </div>

        {/* Ícone da sacola */}
        <ShoppingBag className="w-7 h-7 text-white" />

        {/* Pulso de animação */}
        <div className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-20" />
      </button>

      {/* Painel lateral fixo - NÃO bloqueia navegação */}
      <div
        className={`fixed top-0 right-0 h-full z-30 transition-all duration-300 shadow-2xl ${
          isExpanded ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '380px', maxWidth: '90vw' }}
      >
        <div className="h-full bg-background dark:bg-zinc-900 flex flex-col">
          {/* Header com botão recolher */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2 text-white">
              <ShoppingBag className="w-5 h-5" />
              <span className="font-bold text-lg">
                Meu Carrinho ({totalItems})
              </span>
            </div>
            
            <button
              onClick={() => setIsExpanded(false)}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center"
              title="Recolher"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Lista de itens - Scrollável */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30 dark:bg-zinc-800">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-card dark:bg-zinc-900 rounded-xl p-3 shadow-md hover:shadow-lg transition-all group border border-border dark:border-zinc-700"
              >
                <div className="flex gap-3">
                  {/* Imagem */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted dark:bg-zinc-700">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        {getCategoryEmoji(item.category) || '🍔'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-foreground truncate mb-1">
                      {item.name}
                    </h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (item.quantity <= 1) {
                              onRemove(item.id);
                            } else if (onUpdateQuantity) {
                              onUpdateQuantity(item.id, item.quantity - 1);
                            }
                          }}
                          className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 hover:bg-red-500 hover:text-white text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-all text-xs font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-foreground w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-all text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-bold text-amber-600 dark:text-amber-500">
                        R${(item.price * item.quantity).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>

                  {/* Botão remover */}
                  <button
                    onClick={() => onRemove(item.id)}
                    className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all flex-shrink-0 self-start"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer com total e botão */}
          <div className="border-t-2 border-border dark:border-zinc-800 p-4 space-y-3 bg-card dark:bg-zinc-900 shadow-2xl">
            {/* Total */}
            <div className="flex items-center justify-between bg-primary/10 dark:bg-zinc-800 px-4 py-3 rounded-xl">
              <span className="font-bold text-foreground text-lg">Total:</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                R${totalPrice.toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Botão finalizar pedido */}
            <button
              onClick={onOpenFullCart}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-4 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
            >
              Finalizar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* Overlay sutil quando expandido - NÃO clicável */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black/20 z-20 pointer-events-none" />
      )}
    </>
  );
}