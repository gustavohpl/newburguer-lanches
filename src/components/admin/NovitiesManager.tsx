import React, { useEffect, useState } from 'react';
import { Sparkles, Plus, X, Search, Package } from 'lucide-react';
import { useConfig } from '../../ConfigContext';
import { adminFetch } from '../../utils/api';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  image?: string;
  category?: string;
  available?: boolean;
}

export function NovitiesManager() {
  const { config, refreshConfig } = useConfig();
  const themeColor = config.themeColor || '#d97706';
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const noveltyIds: string[] = (config as any).noveltyProductIds || [];

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/products', { method: 'GET' });
      const data = await res.json();
      if (data.success) {
        setAllProducts(data.products || []);
      }
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveIds = async (ids: string[]) => {
    setSaving(true);
    try {
      await adminFetch('/admin/config', {
        method: 'POST',
        body: JSON.stringify({ noveltyProductIds: ids }),
      });
      await refreshConfig();
    } catch (e) {
      console.error('Erro ao salvar:', e);
    } finally {
      setSaving(false);
    }
  };

  const addProduct = async (productId: string) => {
    if (noveltyIds.includes(productId)) return;
    const newIds = [...noveltyIds, productId];
    await saveIds(newIds);
    setShowPicker(false);
    setSearch('');
  };

  const removeProduct = async (productId: string) => {
    const newIds = noveltyIds.filter(id => id !== productId);
    await saveIds(newIds);
  };

  // Produtos selecionados como novidades
  const selectedProducts = noveltyIds
    .map(id => allProducts.find(p => p.id === id))
    .filter((p): p is Product => p !== undefined);

  // Produtos disponíveis para adicionar (não estão em novidades)
  const availableProducts = allProducts
    .filter(p => !noveltyIds.includes(p.id) && p.available !== false)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mt-4">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4">
        <p className="text-xs text-purple-700">
          <strong>✨ Como funciona:</strong> Selecione produtos existentes para aparecer na seção "Novidades" 
          da página do cliente. A seção só aparece quando há pelo menos 1 produto adicionado.
        </p>
      </div>

      {/* Lista de produtos em Novidades */}
      {loading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      ) : selectedProducts.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 mb-4">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium text-sm">Nenhum produto em Novidades</p>
          <p className="text-xs text-gray-400 mt-1">Adicione produtos para criar a seção no site</p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {selectedProducts.map((product, index) => (
            <div
              key={product.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-all"
            >
              <div 
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0 bg-purple-500"
              >
                {index + 1}
              </div>

              {(product.imageUrl || product.image) ? (
                <img src={product.imageUrl || product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate text-gray-800">{product.name}</p>
                <p className="text-xs text-gray-500">R$ {product.price?.toFixed(2)}</p>
              </div>

              <button
                onClick={() => removeProduct(product.id)}
                disabled={saving}
                className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-all flex-shrink-0"
                title="Remover de Novidades"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botão Adicionar */}
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 font-bold text-sm hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Produto às Novidades
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Busca */}
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                autoFocus
              />
            </div>
            <button
              onClick={() => { setShowPicker(false); setSearch(''); }}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancelar
            </button>
          </div>

          {/* Lista de produtos disponíveis */}
          <div className="max-h-60 overflow-y-auto">
            {availableProducts.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">Nenhum produto encontrado</p>
            ) : (
              availableProducts.slice(0, 20).map(product => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 p-3 hover:bg-purple-50 transition-colors text-left border-b border-gray-100 last:border-0"
                >
                  {(product.imageUrl || product.image) ? (
                    <img src={product.imageUrl || product.image} alt={product.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Package className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500">R$ {product.price?.toFixed(2)} • {product.category}</p>
                  </div>
                  <Plus className="w-4 h-4 text-purple-500 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
