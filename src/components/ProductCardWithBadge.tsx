import React from 'react';
import { ProductCard } from './ProductCard';
import type { Product } from '../App';

interface ProductCardWithBadgeProps {
  product: Product;
  onAddToCart: (product: Product, notes?: string, quantity?: number) => void;
  badge?: {
    text: string;
    color: string;
    icon: React.ReactNode;
  };
}

export function ProductCardWithBadge({ product, onAddToCart, badge }: ProductCardWithBadgeProps) {
  if (!badge) {
    return <ProductCard product={product} onAddToCart={onAddToCart} />;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden transition-all hover:shadow-xl border-2 border-amber-200 dark:border-zinc-700">
      <div className={`${badge.color} text-white px-3 py-2 flex items-center justify-center gap-2`}>
        {badge.icon}
        <span className="text-sm font-semibold">{badge.text}</span>
      </div>
      <div className="relative">
        {/* Renderizar conteúdo interno do ProductCard sem wrapper duplicado */}
        <ProductCard product={product} onAddToCart={onAddToCart} noBorder />
      </div>
    </div>
  );
}