import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, Plus, Minus } from 'lucide-react';
import { Product } from '../utils/api';
import { useConfig } from '../ConfigContext';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { resolveColorToHex, darkenHex } from '../utils/colorUtils';
import { getVisibleIngredients } from '../utils/ingredientUtils';
import { useI18n } from '../hooks/useI18n';

interface AddToCartModalProps {
  product: Product;
  onConfirm: (product: Product, notes: string, quantity: number) => void;
  onClose: () => void;
  categoryColor?: string; // Cor da categoria (classe Tailwind ou hex)
}

export function AddToCartModal({ product, onConfirm, onClose, categoryColor }: AddToCartModalProps) {
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { config } = useConfig();
  const { t } = useI18n();
  const promoData = product.promoItems;
  const originalTotal = product.originalTotal;
  const hasPromo = promoData && promoData.length > 0 && originalTotal && originalTotal > product.price;

  // Determinar cor efetiva: se feature ativa + cor da categoria existe, usar; senão fallback para themeColor
  const themeColor = config.themeColor || '#d97706';
  const resolvedCategoryColor = resolveColorToHex(categoryColor);
  const effectiveColor = (config.useCategoryColorInModals && resolvedCategoryColor) ? resolvedCategoryColor : themeColor;
  const effectiveColorDark = darkenHex(effectiveColor);

  // Estado para hover do botão Adicionar
  const [addBtnHover, setAddBtnHover] = useState(false);

  // Montar lista de ingredientes visíveis com quantidades
  const visibleIngredients = getVisibleIngredients(product);

  const handleConfirm = () => {
    onConfirm(product, notes.trim(), quantity);
  };

  // Permitir confirmar com Enter (se não tiver quebra de linha)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  // Estado para focus do textarea
  const [textareaFocused, setTextareaFocused] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header — usa cor efetiva */}
        <div
          className="text-white p-4 flex items-center justify-between"
          style={{ backgroundColor: effectiveColor }}
        >
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6" />
            <h3 className="text-lg font-bold">{t('products.addToCart')}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white p-1 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Produto — imagem + nome/preço lado a lado */}
          <div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-md overflow-hidden">
            <div className="flex">
              {/* Imagem do produto */}
              {(product.imageUrl || product.image) && (
                <div className="w-24 min-w-[6rem] h-24 flex-shrink-0">
                  <ImageWithFallback
                    src={product.imageUrl || product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {/* Nome, promo badges, descrição, preço */}
              <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-white text-base leading-tight line-clamp-2">{product.name}</h4>
                  {/* Itens da promoção */}
                  {hasPromo && promoData && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {promoData.map((item, idx) => (
                        <span key={idx} className="inline-block bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                          {item.productName}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Descrição só mostra quando NÃO há ingredientes visíveis e não é promo */}
                  {product.description && visibleIngredients.length === 0 && !hasPromo && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-2">{product.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {hasPromo && originalTotal && (
                    <span className="text-xs text-gray-400 line-through">
                      R$ {originalTotal.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                  <p
                    className={`font-bold text-lg ${hasPromo ? 'text-red-600 dark:text-red-500' : ''}`}
                    style={!hasPromo ? { color: effectiveColor } : undefined}
                  >
                    R$ {(product.price * quantity).toFixed(2).replace('.', ',')}
                  </p>
                  {hasPromo && (
                    <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      -{Math.round(((originalTotal - product.price) / originalTotal) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ingredientes Visíveis — sem label "Ingredientes:" */}
          {visibleIngredients.length > 0 && (
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 text-sm">
              {visibleIngredients.map((ingredient, index) => (
                <li key={index}>{ingredient}</li>
              ))}
            </ul>
          )}

          {/* Seletor de Quantidade */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('cart.quantity')}</span>
            <div className="flex items-center gap-0">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-l-lg text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: quantity <= 1 ? '#9ca3af' : effectiveColor }}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="w-12 h-9 flex items-center justify-center text-base font-bold border-y-2 bg-white dark:bg-zinc-900 text-gray-800 dark:text-white"
                style={{ borderColor: effectiveColor }}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => Math.min(99, q + 1))}
                className="w-9 h-9 flex items-center justify-center rounded-r-lg text-white font-bold transition-all cursor-pointer hover:opacity-90"
                style={{ backgroundColor: effectiveColor }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Campo de Observações */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 text-sm">
              🗒️ {t('checkout.notes')} ({t('common.or')} {t('common.cancel').toLowerCase()})
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => setTextareaFocused(false)}
              placeholder="Ex: sem cebola, sem maionese, ponto da carne mal passado..."
              className="w-full border-2 rounded-lg p-3 text-sm focus:outline-none resize-none bg-white dark:bg-zinc-800 dark:text-white"
              style={{
                borderColor: textareaFocused ? effectiveColor : undefined,
                boxShadow: textareaFocused ? `0 0 0 3px ${effectiveColor}25` : undefined,
              }}
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
              {notes.length}/200 caracteres
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 py-3 rounded-lg font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 text-white py-3 rounded-lg font-bold transition-colors shadow-md flex items-center justify-center gap-2"
              style={{ backgroundColor: addBtnHover ? effectiveColorDark : effectiveColor }}
              onMouseEnter={() => setAddBtnHover(true)}
              onMouseLeave={() => setAddBtnHover(false)}
            >
              <ShoppingCart className="w-4 h-4" />
              {quantity > 1 ? t('products.addToCartWithQty', { qty: String(quantity) }) : t('products.addToCart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}