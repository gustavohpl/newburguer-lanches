import React, { useEffect, useState } from 'react';
import { Star, Trophy } from 'lucide-react';
import { useConfig } from '../ConfigContext';
import * as api from '../utils/api';
import { ProductCard } from './ProductCard';
import type { Product } from '../App';

interface TopRatedProductsProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number) => void;
}

export function TopRatedProducts({ products, onAddToCart }: TopRatedProductsProps) {
  const { config } = useConfig();
  const [topRated, setTopRated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se a feature estiver desativada, não faz nada
    if (config.features?.reviews === false) {
      setLoading(false);
      return;
    }

    const fetchTopRated = async () => {
      try {
        const response = await api.getAllOrders();
        if (response.success && response.orders) {
          const productRatings: Record<string, { total: number; count: number }> = {};

          // Calcular médias baseadas nos reviews dos pedidos
          response.orders.forEach((order: any) => {
            if (order.reviews && Array.isArray(order.reviews)) {
              order.reviews.forEach((review: any) => {
                // Normalizar nome do produto para chave (simples)
                const productName = review.productName;
                if (!productRatings[productName]) {
                  productRatings[productName] = { total: 0, count: 0 };
                }
                productRatings[productName].total += review.rating;
                productRatings[productName].count += 1;
              });
            }
          });

          // Processar TODOS os produtos disponíveis para identificar destaques e notas
          const allRankedProducts = products.map(product => {
            const stats = productRatings[product.name] || { total: 0, count: 0 };
            const averageRating = stats.count > 0 ? stats.total / stats.count : 0;
            
            return {
              ...product,
              calculatedRating: averageRating,
              reviewCount: stats.count,
              // featuredRating já existe no produto
            };
          });

          // Filtrar e Ordenar
          const topProducts = allRankedProducts
            .filter(p => p.featuredRating || p.reviewCount > 0) // Mantém se for destaque OU tiver avaliações
            .sort((a, b) => {
              // 1. Destaques primeiro
              if (a.featuredRating && !b.featuredRating) return -1;
              if (!a.featuredRating && b.featuredRating) return 1;
              
              // 2. Maior nota
              const ratingDiff = b.calculatedRating - a.calculatedRating;
              if (ratingDiff !== 0) return ratingDiff;
              
              // 3. Mais avaliações
              return b.reviewCount - a.reviewCount;
            })
            .slice(0, 3); // Top 3

          setTopRated(topProducts);
        }
      } catch (error) {
        console.error('Erro ao buscar top avaliados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopRated();
  }, [config.features?.reviews, products]);

  // 🔧 CORREÇÃO: Só retorna null se a feature estiver DESATIVADA
  // Se estiver ativada mas sem avaliações, mostra a seção vazia
  if (config.features?.reviews === false) {
    return null;
  }

  const themeColor = config.themeColor || '#d97706';

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="text-white p-3 rounded-lg shadow-md"
          style={{ backgroundColor: '#fbbf24' }} // Amber-400 para estrelas
        >
          <Trophy className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Top 3 Avaliados</h2>
      </div>
      
      {loading ? (
        <div className="bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Carregando avaliações...</p>
        </div>
      ) : topRated.length === 0 ? (
        <div className="bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8 text-center">
          <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Ainda não há produtos avaliados</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Os produtos mais bem avaliados aparecerão aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {topRated.map((product, index) => (
            <div key={product.id} className="relative">
              {/* Badge de Ranking */}
              <div className="absolute -top-2 -left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg border-2 border-white dark:border-zinc-800"
                   style={{ backgroundColor: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : '#b45309' }}>
                #{index + 1}
              </div>
              
              <ProductCard
                product={product}
                onAddToCart={onAddToCart}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}