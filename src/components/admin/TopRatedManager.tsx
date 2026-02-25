import React, { useState, useEffect } from 'react';
import { Star, Trophy, Check, X, Loader } from 'lucide-react';
import * as api from '../../utils/api';
import type { Product } from '../../App';

interface RatingStats {
  productName: string;
  rating: number;
  count: number;
  productId?: string;
}

interface TopRatedManagerProps {
  products: Product[];
  onProductUpdate: () => void;
}

export function TopRatedManager({ products, onProductUpdate }: TopRatedManagerProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RatingStats[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.getFullOrderHistory();
      if (response.success && response.orders) {
        const productRatings: Record<string, { total: number; count: number }> = {};

        response.orders.forEach((order: any) => {
          if (order.reviews && Array.isArray(order.reviews)) {
            order.reviews.forEach((review: any) => {
              const name = review.productName;
              if (!productRatings[name]) {
                productRatings[name] = { total: 0, count: 0 };
              }
              productRatings[name].total += review.rating;
              productRatings[name].count += 1;
            });
          }
        });

        const computedStats = Object.entries(productRatings)
          .map(([name, data]) => ({
            productName: name,
            rating: data.total / data.count,
            count: data.count,
            productId: products.find(p => p.name === name)?.id
          }))
          .filter(s => !!s.productId) // Só mostra produtos que ainda existem
          .sort((a, b) => b.rating - a.rating || b.count - a.count);

        setStats(computedStats);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatured = async (product: Product) => {
    setIsUpdating(true);
    try {
      const newStatus = !product.featuredRating;
      
      // Se estiver ativando, verifique quantos já estão ativos
      if (newStatus) {
        const currentActive = products.filter(p => p.featuredRating).length;
        if (currentActive >= 3) {
          if (!confirm('Já existem 3 produtos em destaque. Deseja adicionar mais um? (Recomendado manter 3)')) {
            setIsUpdating(false);
            return;
          }
        }
      }

      const response = await api.updateProduct(product.id, { featuredRating: newStatus });
      if (response.success) {
        onProductUpdate();
      } else {
        alert('Erro ao atualizar produto');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao atualizar destaque');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Combinar produtos existentes com estatísticas
  const displayedProducts = products.map(p => {
    const stat = stats.find(s => s.productId === p.id);
    return {
      ...p,
      avgRating: stat ? stat.rating : 0,
      reviewCount: stat ? stat.count : 0
    };
  }).filter(p => p.reviewCount > 0 || p.featuredRating) // Mostrar se tem review OU se já está destacado
    .sort((a, b) => {
        // Ordenar: Destacados primeiro, depois por Rating
        if (a.featuredRating && !b.featuredRating) return -1;
        if (!a.featuredRating && b.featuredRating) return 1;
        return b.avgRating - a.avgRating;
    });

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-400">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Trophy className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerenciar Top 3 Avaliados</h2>
          <p className="text-sm text-gray-600">Escolha quais produtos aparecem em destaque na página inicial.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-3 font-semibold text-gray-600">Produto</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">Avaliação</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">Qtd. Avaliações</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">Destaque</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedProducts.length > 0 ? (
              displayedProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-gray-800">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.category}</div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-bold text-gray-800">{product.avgRating.toFixed(1)}</span>
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </div>
                  </td>
                  <td className="py-3 text-center text-gray-600">
                    {product.reviewCount}
                  </td>
                  <td className="py-3 text-center">
                    <button
                      onClick={() => toggleFeatured(product)}
                      disabled={isUpdating}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        product.featuredRating
                          ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {product.featuredRating ? (
                        <>
                          <Trophy className="w-3 h-3" />
                          Destacado
                        </>
                      ) : (
                        'Destacar'
                      )}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  Nenhum produto com avaliações encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <p>💡 <strong>Dica:</strong> Se nenhum produto for selecionado manualmente, o sistema exibirá automaticamente os 3 melhores avaliados.</p>
      </div>
    </div>
  );
}
