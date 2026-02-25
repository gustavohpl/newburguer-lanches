import React, { useState, useEffect } from 'react';
import { Home, Flame, Percent } from 'lucide-react';
import * as api from '../utils/api';

interface CategoryNavProps {
  currentCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryNav({ currentCategory, onCategoryChange }: CategoryNavProps) {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.getCategories();
      if (response.success) {
        // Filter out 'promocoes' and 'mais-pedidos' as they are handled specially in Home
        // Also filter by label to be sure
        const filteredCategories = response.categories.filter(
          (cat: any) => {
            const id = (cat.id || '').toLowerCase();
            const label = (cat.label || '').toLowerCase();
            
            const isPromo = id === 'promocoes' || id.includes('promo') || label.includes('promo');
            const isBestSeller = id === 'mais-pedidos' || label.includes('mais pedidos') || label.includes('mais vendidos');
            
            return !isPromo && !isBestSeller;
          }
        );
        setCategories(filteredCategories);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias', error);
    }
  };

  const fixedCategories = [
    { id: null, label: 'Início', color: 'bg-amber-600 hover:bg-amber-700', icon: <Home className="w-5 h-5" /> },
  ];

  const allCategories = [
    ...fixedCategories,
    ...categories.map(cat => ({
      id: cat.id,
      label: cat.label,
      color: cat.color || 'bg-amber-600 hover:bg-amber-700',
      icon: null
    }))
  ];

  // Helper: verificar se cor é hex
  const isHexColor = (c: string) => c.startsWith('#');

  return (
    <div className="bg-white dark:bg-zinc-900 shadow-md border-b border-gray-200 dark:border-zinc-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-3 justify-center flex-wrap">
          {allCategories.map((category) => {
            const isActive = currentCategory === category.id;
            const isHex = isHexColor(category.color);

            return (
              <button
                key={category.id ?? 'inicio'}
                onClick={() => onCategoryChange(category.id)}
                className={`${
                  isActive
                    ? (isHex ? '' : category.color) + ' text-white shadow-lg scale-105'
                    : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-700'
                } px-6 py-3 rounded-lg font-semibold transition-all transform flex items-center gap-2 whitespace-nowrap min-w-fit`}
                style={isActive && isHex ? { backgroundColor: category.color } : undefined}
              >
                {category.icon}
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}