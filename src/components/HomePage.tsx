import React from 'react';
import { Percent, Clock, TrendingUp } from 'lucide-react';
import type { Product } from '../App';
import { ProductCard } from './ProductCard';
import { TopRatedProducts } from './TopRatedProducts';
import { HorizontalScroll } from './HorizontalScroll';
import { useConfig } from '../ConfigContext';
import { useI18n } from '../hooks/useI18n';

interface HomePageProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number) => void;
  orderHistory: Product[];
}

export function HomePage({ products, onAddToCart, orderHistory }: HomePageProps) {
  const { config } = useConfig();
  const { t } = useI18n();
  const themeColor = config.themeColor || '#d97706';

  const promotions = products.filter(p => p.category === 'promocoes');
  const bestSellers = products.filter(p => p.category === 'mais-pedidos');

  const availableOrderHistory = orderHistory
    .map(historyProduct => {
      const currentProduct = products.find(p => p.id === historyProduct.id);
      return currentProduct && currentProduct.available ? currentProduct : null;
    })
    .filter((product): product is Product => product !== null);

  const renderProductCard = (product: Product, badge?: { text: string; color: string; icon: React.ReactNode }) => {
    if (!badge) {
      return (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      );
    }
    
    return (
      <div key={product.id} className="bg-card dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden transition-all hover:shadow-xl border-2 border-border dark:border-zinc-700">
        <div 
          className={`${badge.color} text-white px-3 py-2 flex items-center justify-center gap-2`}
          style={{ backgroundColor: !badge.color ? themeColor : undefined }}
        >
          {badge.icon}
          <span className="text-sm font-semibold">{badge.text}</span>
        </div>
        <div className="[&>div]:border-0 [&>div]:rounded-none [&>div]:shadow-none">
          <ProductCard
            product={product}
            onAddToCart={onAddToCart}
          />
        </div>
      </div>
    );
  };

  // Card com largura fixa para scroll horizontal
  const renderScrollCard = (product: Product, badge?: { text: string; color: string; icon: React.ReactNode }) => {
    return (
      <div key={product.id} className="flex-shrink-0 w-[280px] sm:w-[320px]">
        {renderProductCard(product, badge)}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Banner de Boas-vindas */}
      <div 
        className="text-white rounded-lg p-8 text-center shadow-xl border-2 transition-all"
        style={{
          background: `linear-gradient(to right, ${themeColor}, ${themeColor}dd, ${themeColor})`,
          borderColor: `${themeColor}aa`
        }}
      >
        <h1 className="text-3xl font-bold mb-2">Bem-vindo ao {config.siteName || 'NewBurguer Lanches'}! {config.siteEmoji || '🍔'}</h1>
        <p className="text-lg">{config.siteSubtitle || 'Os melhores lanches da região!'}</p>
      </div>

      {/* Banner promocional entre boas-vindas e promoções */}
      {config.homeBannerUrl && (
        <div className="rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:scale-[1.01] cursor-pointer">
          {config.homeBannerLink ? (
            <a href={config.homeBannerLink} target="_blank" rel="noopener noreferrer">
              <img src={config.homeBannerUrl} alt="Banner" className="w-full h-auto object-contain" />
            </a>
          ) : (
            <img src={config.homeBannerUrl} alt="Banner" className="w-full h-auto object-contain" />
          )}
        </div>
      )}

      {/* Promoções - Grid normal */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-500 text-white p-3 rounded-lg shadow-md">
            <Percent className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{t('products.promotions')}</h2>
        </div>
        {promotions.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {promotions.map(product => 
              renderProductCard(product, {
                text: 'PROMOÇÃO',
                color: 'bg-red-500',
                icon: <Percent className="w-4 h-4" />
              })
            )}
          </div>
        ) : (
          <div className="bg-muted/30 dark:bg-zinc-900 border-2 border-dashed border-border dark:border-zinc-700 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">{t('products.noProducts')}</p>
          </div>
        )}
      </section>

      {/* Mais Vendidos - SCROLL HORIZONTAL */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="text-white p-3 rounded-lg shadow-md"
            style={{ backgroundColor: themeColor }}
          >
            <TrendingUp className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Mais Vendidos</h2>
        </div>
        {bestSellers.length > 0 ? (
          <HorizontalScroll>
            {bestSellers.map(product => 
              renderScrollCard(product, {
                text: 'BEST SELLER',
                color: '',
                icon: <TrendingUp className="w-4 h-4" />
              })
            )}
          </HorizontalScroll>
        ) : (
          <div className="bg-muted/30 dark:bg-zinc-900 border-2 border-dashed border-border dark:border-zinc-700 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Nenhum produto em destaque no momento</p>
          </div>
        )}
      </section>

      {/* Top 3 Avaliados - SCROLL HORIZONTAL */}
      <TopRatedProducts products={products} onAddToCart={onAddToCart} />

      {/* Comprar Novamente - SCROLL HORIZONTAL */}
      {availableOrderHistory.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500 text-white p-3 rounded-lg shadow-md">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Comprar Novamente</h2>
          </div>
          <HorizontalScroll>
            {availableOrderHistory.slice(0, 10).map(product => 
              renderScrollCard(product, {
                text: 'VOCÊ JÁ COMPROU',
                color: 'bg-blue-500',
                icon: <Clock className="w-4 h-4" />
              })
            )}
          </HorizontalScroll>
        </section>
      )}
    </div>
  );
}
