import React, { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import type { Product } from '../App';
import * as api from '../utils/api';

interface CategoryPageProps {
  category: string;
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number) => void;
}

export function CategoryPage({ category, products, onAddToCart }: CategoryPageProps) {
  const [categoryInfo, setCategoryInfo] = useState<{ label: string; description?: string }>({ 
    label: category, 
    description: 'Confira nossas opções' 
  });

  useEffect(() => {
    loadCategoryInfo();
  }, [category]);

  const loadCategoryInfo = async () => {
    // Check for system categories first
    if (category === 'promocoes') {
      setCategoryInfo({ 
        label: 'Promoções', 
        description: 'Ofertas especiais para você' 
      });
      return;
    }
    if (category === 'mais-pedidos') {
      setCategoryInfo({ 
        label: 'Mais Pedidos', 
        description: 'Os favoritos da galera' 
      });
      return;
    }

    // Check DB categories
    try {
      const response = await api.getCategories();
      if (response.success && response.categories) {
        const found = response.categories.find((c: any) => c.id === category);
        if (found) {
          setCategoryInfo({ 
            label: found.label, 
            description: `Deliciosas opções de ${found.label.toLowerCase()}` 
          });
        } else {
          // Fallback formatting
          setCategoryInfo({ 
            label: category.charAt(0).toUpperCase() + category.slice(1), 
            description: 'Confira nossas opções' 
          });
        }
      }
    } catch (e) {
      // Fallback
       setCategoryInfo({ 
            label: category.charAt(0).toUpperCase() + category.slice(1), 
            description: 'Confira nossas opções' 
      });
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-block bg-white/80 dark:bg-black/50 backdrop-blur-sm px-6 py-3 rounded-lg shadow-md border border-gray-200/30 dark:border-white/10">
          <h1 className="text-3xl text-gray-800 dark:text-white mb-1 font-bold">{categoryInfo.label}</h1>
        </div>
        <div className="inline-block bg-orange-100/70 dark:bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg mt-3 mx-auto">
          <p className="text-black dark:text-white font-medium">{categoryInfo.description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
          />
        ))}
        {products.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm rounded-lg border border-gray-200/30 dark:border-zinc-800/30">
            <p className="text-gray-500 text-lg">Nenhum produto encontrado nesta categoria.</p>
          </div>
        )}
      </div>
    </div>
  );
}