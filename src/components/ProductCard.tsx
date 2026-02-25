import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Info } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Product } from '../utils/api';
import { toast } from 'sonner@2.0.3';
import { AddToCartModal } from './AddToCartModal';
import { useConfig } from '../ConfigContext';
import { resolveColorToHex } from '../utils/colorUtils';
import { getVisibleIngredients } from '../utils/ingredientUtils';
import { useI18n } from '../hooks/useI18n';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, notes?: string, quantity?: number) => void;
  noBorder?: boolean;
}

export function ProductCard({ product, onAddToCart, noBorder }: ProductCardProps) {
  const isAvailable = product.available !== false;
  const [showModal, setShowModal] = useState(false);
  const { config } = useConfig();
  const { t } = useI18n();
  const themeColor = config.themeColor || '#d97706';

  // Estado para zoom da imagem (hover desktop + touch mobile)
  const [imgZoomed, setImgZoomed] = useState(false);

  // Derivar cor da categoria direto do ConfigContext (sem API call)
  // O config.categories já vem do endpoint /config/public com todas as cores
  const categoryColor = useMemo(() => {
    if (!config.useCategoryColorInModals) return undefined;
    
    // 1) Tentar config.categories do ConfigContext
    const cats = config.categories as Array<{ id: string; label?: string; color?: string }> | undefined;
    if (cats && cats.length > 0) {
      const cat = cats.find((c) => c.id === product.category);
      if (cat?.color) {
        return cat.color;
      }
    }
    
    // 2) Fallback: localStorage faroeste_categories (salvo pelo api.getCategories)
    try {
      const local = localStorage.getItem('faroeste_categories');
      if (local) {
        const localCats = JSON.parse(local);
        const cat = localCats.find((c: { id: string; color?: string }) => c.id === product.category);
        if (cat?.color) {
          return cat.color;
        }
      }
    } catch (e) {}
    
    return undefined;
  }, [config.useCategoryColorInModals, config.categories, product.category]);

  // Cor efetiva: cor da categoria (resolvida para hex) se habilitada, senão themeColor
  const resolvedCatColor = resolveColorToHex(categoryColor);
  const effectiveColor = (config.useCategoryColorInModals && resolvedCatColor) ? resolvedCatColor : themeColor;

  // Detectar dark mode reativamente
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const promoData = product.promoItems;
  const originalTotal = product.originalTotal;
  const hasPromo = promoData && promoData.length > 0 && originalTotal && originalTotal > product.price;
  const discountPct = hasPromo ? Math.round(((originalTotal - product.price) / originalTotal) * 100) : 0;

  // Montar lista de ingredientes visíveis para o cliente
  const visibleIngredients = getVisibleIngredients(product);

  const handleAddClick = () => {
    if (isAvailable) {
      setShowModal(true);
    }
  };

  const handleConfirmAdd = (product: Product, notes: string, quantity: number) => {
    onAddToCart(product, notes, quantity);
    setShowModal(false);
    
    // Feedback visual com toast
    const qtyLabel = quantity > 1 ? `${quantity}x ` : '';
    const message = notes 
      ? `${qtyLabel}${product.name} ${t('products.addToCart')}! 🛒`
      : `${qtyLabel}${product.name} ${t('products.addToCart')}! 🛒`;
    
    toast.success(message, {
      duration: 2000,
      position: 'bottom-center',
    });
  };

  // Obter URL da imagem - suportar tanto 'image' quanto 'imageUrl'
  const getImageUrl = () => {
    if (product.imageUrl) return product.imageUrl;
    if (product.image) return product.image;
    return '';
  };

  return (
    <>
      <div
        onClick={handleAddClick}
        className={`bg-card dark:bg-zinc-900 rounded-xl overflow-hidden transition-all hover:shadow-md cursor-pointer ${
          isAvailable ? 'shadow-sm' : 'shadow-sm opacity-60'
        } ${noBorder ? '' : 'border border-border dark:border-zinc-800'}`}
      >
        <div className="flex">
          {/* Imagem - Thumbnail à esquerda */}
          <div
            className="relative w-28 min-w-[7rem] sm:w-32 sm:min-w-[8rem] h-auto min-h-[7rem] flex-shrink-0 overflow-hidden"
            onMouseEnter={() => setImgZoomed(true)}
            onMouseLeave={() => setImgZoomed(false)}
            onTouchStart={() => setImgZoomed(true)}
            onTouchEnd={() => setTimeout(() => setImgZoomed(false), 600)}
          >
            <ImageWithFallback
              src={getImageUrl()}
              alt={product.name}
              className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                imgZoomed ? 'scale-110' : 'scale-100'
              }`}
            />
            {!isAvailable && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold">
                  {t('products.unavailable').toUpperCase()}
                </span>
              </div>
            )}
            {hasPromo && (
              <div className="absolute top-1.5 left-1.5 bg-red-600 text-white px-1.5 py-0.5 text-[10px] font-bold rounded-md shadow-lg">
                -{discountPct}%
              </div>
            )}
          </div>

          {/* Conteúdo - Nome, descrição, preço à direita */}
          <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
            {/* Nome */}
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground leading-tight line-clamp-2">
                {product.name}
              </h3>

              {/* Produtos inclusos na promoção */}
              {hasPromo && promoData && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {promoData.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-block bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-red-200 dark:border-red-700/40"
                    >
                      {item.productName}
                    </span>
                  ))}
                </div>
              )}

              {/* Descrição — só mostra se NÃO houver ingredientes visíveis */}
              {product.description && visibleIngredients.length === 0 && !hasPromo && (
                <p className="text-gray-400 text-xs sm:text-sm mt-1 line-clamp-2 leading-snug">
                  {product.description}
                </p>
              )}

              {/* Ingredientes visíveis para o cliente */}
              {visibleIngredients.length > 0 && (
                <p className="text-gray-400 text-xs sm:text-sm mt-1 line-clamp-2 leading-snug">
                  {visibleIngredients.join(', ')}
                </p>
              )}
            </div>

            {/* Preço + Botão */}
            <div className="flex items-center justify-between mt-2.5 gap-2">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {hasPromo && originalTotal && (
                  <span className="text-xs text-gray-400 line-through">
                    R$ {originalTotal.toFixed(2).replace('.', ',')}
                  </span>
                )}
                <span className={`text-base sm:text-lg font-bold ${hasPromo ? 'text-red-600 dark:text-red-500' : ''}`} style={!hasPromo ? { color: effectiveColor } : {}}>
                  R$ {product.price.toFixed(2).replace('.', ',')}
                </span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleAddClick(); }}
                disabled={!isAvailable}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all shadow-sm active:scale-95 flex-shrink-0 ${
                  isAvailable
                    ? 'text-white hover:shadow-md'
                    : 'bg-gray-300 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                style={isAvailable ? { backgroundColor: effectiveColor } : {}}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Observações */}
      {showModal && (
        <AddToCartModal
          product={product}
          onConfirm={handleConfirmAdd}
          onClose={() => setShowModal(false)}
          categoryColor={categoryColor}
        />
      )}
    </>
  );
}