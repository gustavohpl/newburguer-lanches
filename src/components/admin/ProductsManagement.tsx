import React, { useState, useEffect } from 'react';
import { BestSellersManager } from './BestSellersManager';
import { NovitiesManager } from './NovitiesManager';
import { Plus, Edit, Trash2, Image as ImageIcon, X, Save, Loader, Settings, Trophy, AlertTriangle, Package, BoxSelect, Utensils, Search, ChevronDown, ChevronUp, Percent, TrendingUp, Sparkles } from 'lucide-react';
import * as api from '../../utils/api';
import type { Product } from '../../App';
import { CategoryManager } from './CategoryManager';
import { TopRatedManager } from './TopRatedManager';
import { PromotionsManager } from './PromotionsManager';
import { useConfig } from '../../ConfigContext';
import type { StockIngredient, RecipeIngredient, ExtraIngredient, ProductRecipe } from '../../utils/api';

interface ProductsManagementProps {
  onProductsChange: () => void;
}

export function ProductsManagement({ onProductsChange }: ProductsManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<api.Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showTopRatedManager, setShowTopRatedManager] = useState(false);
  const [showPromotionsManager, setShowPromotionsManager] = useState(false);
  const [showBestSellersManager, setShowBestSellersManager] = useState(false);
  const [showNovitiesManager, setShowNovitiesManager] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true,
    imageUrl: '',
    ingredientsText: '', // Usado quando stockControl está OFF
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Stock control state
  const { config } = useConfig();
  const stockEnabled = config.features?.stockControl || false;
  const [stockIngredients, setStockIngredients] = useState<StockIngredient[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [extraIngredients, setExtraIngredients] = useState<ExtraIngredient[]>([]);
  const [unavailableProducts, setUnavailableProducts] = useState<string[]>([]);
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');

  // AbortController ref para cancelar fetches em unmount
  const abortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadData(controller.signal).catch(() => {}); // Ignorar erros de abort no unmount
    return () => { controller.abort(new DOMException('Component unmounted', 'AbortError')); };
  }, []);

  const [localProductsCount, setLocalProductsCount] = useState(0);

  const loadData = async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const promises: Promise<any>[] = [loadProducts(), loadCategories()];
      if (stockEnabled) {
        promises.push(loadStockIngredients());
        promises.push(loadStockAvailability(signal));
      }
      await Promise.all(promises);
      
      // Verificar produtos locais (só se não abortou)
      if (signal?.aborted) return;
      const local = localStorage.getItem('faroeste_products');
      if (local) {
        const parsed = JSON.parse(local);
        setLocalProductsCount(parsed.length);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  const loadStockIngredients = async () => {
    try {
      const res = await api.getStockIngredients();
      if (res.success) setStockIngredients(res.ingredients || []);
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Erro ao carregar ingredientes do estoque:', err);
    }
  };

  const loadStockAvailability = async (signal?: AbortSignal) => {
    try {
      const res = await api.checkStockAvailability(signal);
      if (res.success && !res.aborted) setUnavailableProducts(res.unavailableProducts || []);
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Erro ao verificar disponibilidade:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.getCategories();
      if (response.success) {
        setCategories(response.categories);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias', error);
    }
  };

  const loadProducts = async () => {
    try {
      console.log('🔄 [PRODUCTS MGMT] Carregando produtos...');
      const response = await api.getAllProducts();
      console.log('📦 [PRODUCTS MGMT] Produtos recebidos:', response);
      if (response.success) {
        setProducts(response.products || []);
      }
    } catch (error) {
      console.error('❌ [PRODUCTS MGMT] Erro ao carregar produtos:', error);
    }
  };

  const handleSeed = async () => {
    if (!confirm('Deseja restaurar os produtos padrão do sistema?')) return;
    
    try {
      setIsLoading(true);
      const response = await api.seedProducts();
      if (response.success) {
        alert('Produtos restaurados com sucesso!');
        await loadProducts();
        onProductsChange();
      } else {
        alert('Erro ao restaurar produtos: ' + response.error);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncLocal = async () => {
    if (!confirm(`Deseja enviar os ${localProductsCount} produtos locais para o servidor?`)) return;

    try {
      setIsLoading(true);
      const local = JSON.parse(localStorage.getItem('faroeste_products') || '[]');
      
      let successCount = 0;
      for (const product of local) {
        // Remover ID para criar novo
        const { id, ...data } = product;
        const res = await api.createProduct(data);
        if (res.success) successCount++;
      }

      alert(`${successCount} produtos sincronizados com sucesso!`);
      // Limpar local storage para evitar duplicatas futuras ou confusão? 
      // Melhor não limpar, deixar o sistema se ajustar.
      
      await loadProducts();
      onProductsChange();
    } catch (error) {
      console.error('Erro na sincronização:', error);
      alert('Erro ao sincronizar produtos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('️ ATENÇÃO! Isso vai deletar TODOS os produtos. Tem certeza?')) {
      return;
    }

    try {
      const response = await api.deleteAllProducts();
      if (response.success) {
        alert(`✅ ${response.message}`);
        await loadProducts();
        onProductsChange();
      }
    } catch (error) {
      console.error('Erro ao limpar produtos:', error);
      alert('Erro ao limpar produtos');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja deletar este produto?')) return;

    try {
      await api.deleteProduct(id);
      await loadProducts();
      onProductsChange();
      alert('Produto deletado com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      alert('Erro ao deletar produto');
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category,
      available: product.available ?? true,
      imageUrl: product.imageUrl || '',
      ingredientsText: product.ingredientsText || '',
    });
    // Carregar ficha técnica se existir
    setRecipeIngredients(product.recipe?.ingredients || []);
    setExtraIngredients(product.recipe?.extras || []);
    if (stockEnabled) loadStockIngredients();
    setIngredientPickerOpen(false);
    setIngredientSearch('');
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: categories.length > 0 ? categories[0].id : '',
      available: true,
      imageUrl: '',
      ingredientsText: '',
    });
    setRecipeIngredients([]);
    setExtraIngredients([]);
    if (stockEnabled) loadStockIngredients();
    setIngredientPickerOpen(false);
    setIngredientSearch('');
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande! Máximo 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      const response = await api.uploadProductImage(file);
      
      if (response.success && response.url) {
        setFormData({ ...formData, imageUrl: response.url });
        alert('Imagem enviada com sucesso!');
      } else {
        alert('Erro ao fazer upload da imagem');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.category) {
      alert('Preencha nome, preço e categoria');
      return;
    }

    const productData: any = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      category: formData.category,
      available: formData.available,
      imageUrl: formData.imageUrl || null,
    };

    if (stockEnabled) {
      // Incluir ficha técnica — garantir hideFromClient para embalagens e acompanhamentos
      const finalRecipeIngredients = recipeIngredients.map(ri => {
        const ing = stockIngredients.find(s => s.id === ri.ingredientId);
        const cat = ing?.category || 'ingredient';
        const enriched = {
          ...ri,
          category: cat,
          defaultQuantityPerOrder: cat === 'acompanhamento' ? (ing?.defaultQuantity || ri.quantityUsed || 1) : undefined,
        };
        if (cat === 'embalagem' || cat === 'acompanhamento') {
          enriched.hideFromClient = true;
        }
        return enriched;
      });

      productData.recipe = {
        ingredients: finalRecipeIngredients,
        extras: extraIngredients,
      };

      // Gerar descrição automaticamente a partir dos ingredientes visíveis
      const visibleRecipe = finalRecipeIngredients
        .filter(ri => !ri.hideFromClient)
        .map(ri => {
          const name = ri.ingredientName || stockIngredients.find(s => s.id === ri.ingredientId)?.name;
          if (!name) return null;
          const qty = ri.quantityUsed || 1;
          let label = '';
          if (qty > 1) label += `${qty}x `;
          label += name;
          // Só mostra porção se o nome do ingrediente NÃO estiver contido no label da porção (e vice-versa)
          if (ri.selectedPortionLabel) {
            const nameNorm = name.trim().toLowerCase();
            const portionNorm = ri.selectedPortionLabel.trim().toLowerCase();
            if (!portionNorm.includes(nameNorm) && !nameNorm.includes(portionNorm)) {
              label += ` (${ri.selectedPortionLabel})`;
            }
          }
          return label;
        })
        .filter(Boolean);
      const visibleExtras = extraIngredients
        .filter(ei => !ei.hideFromClient && ei.name.trim())
        .map(ei => ei.name.trim());
      const allVisible = [...visibleRecipe, ...visibleExtras];
      productData.description = allVisible.length > 0
        ? allVisible.join(', ')
        : '';
    }

    try {
      if (editingProduct) {
        const response = await api.updateProduct(editingProduct.id, productData);
        if (response.success) {
            alert('Produto atualizado com sucesso!');
        }
      } else {
        const response = await api.createProduct(productData);
         if (response.success) {
            alert('Produto criado com sucesso!');
        }
      }
      
      setIsModalOpen(false);
      await loadProducts();
      onProductsChange();
    } catch (error) {
      console.error('❌ Erro ao salvar produto:', error);
      alert('Erro ao salvar produto');
    }
  };

  // Combine system categories with managed categories for filtering
  const filterCategories = [
    { id: 'all', label: 'Todos' },
    { id: 'novidades', label: 'Novidades' }, // System category
    { id: 'mais-pedidos', label: 'Mais Pedidos' }, // System category
    { id: 'promocoes', label: 'Promoções' }, // System category
    ...categories.map(c => ({ id: c.id, label: c.label }))
  ];

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciar Produtos</h2>
          <p className="text-gray-600">Total: {products.length} produtos</p>
        </div>
        <div className="flex gap-2">
           {config.features?.reviews !== false && (
           <button
            onClick={() => {
              setShowTopRatedManager(!showTopRatedManager);
              setShowCategoryManager(false);
            }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              showTopRatedManager
                ? 'bg-amber-600 text-white' 
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Top Avaliados
          </button>
           )}

          <button
            onClick={() => {
              setShowCategoryManager(!showCategoryManager);
              setShowTopRatedManager(false);
            }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              showCategoryManager 
                ? 'bg-blue-600 text-white' 
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Categorias
          </button>
          
          <button
            onClick={handleClearAll}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Tudo
          </button>
          <button
            onClick={handleNew}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Top Rated Manager */}
      {showTopRatedManager && (
        <TopRatedManager 
          products={products} 
          onProductUpdate={() => {
            loadProducts();
            onProductsChange();
          }} 
        />
      )}

      {/* Category Manager */}
      {showCategoryManager && (
        <CategoryManager onChange={() => {
            loadCategories();
            // NÃO chamar onProductsChange() aqui — mudança de categorias não precisa 
            // destruir/remontar o ProductsManagement inteiro (refreshKey). 
            // O loadCategories() já atualiza a lista de categorias localmente.
        }} />
      )}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filterCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setShowPromotionsManager(cat.id === 'promocoes');
              setShowBestSellersManager(cat.id === 'mais-pedidos');
              setShowNovitiesManager(cat.id === 'novidades');
            }}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap border flex items-center gap-1.5 ${
              selectedCategory === cat.id
                ? cat.id === 'promocoes'
                  ? 'bg-red-600 text-white border-red-600'
                  : cat.id === 'mais-pedidos'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : cat.id === 'novidades'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.id === 'promocoes' && <Percent className="w-3.5 h-3.5" />}
            {cat.id === 'mais-pedidos' && <TrendingUp className="w-3.5 h-3.5" />}
            {cat.id === 'novidades' && <Sparkles className="w-3.5 h-3.5" />}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Promotions Manager — quando filtro Promoções está ativo */}
      {showPromotionsManager && selectedCategory === 'promocoes' && (
        <PromotionsManager onProductsChange={() => {
          loadProducts();
          onProductsChange();
        }} />
      )}

      {/* Best Sellers Manager — quando filtro Mais Pedidos está ativo */}
      {showBestSellersManager && selectedCategory === 'mais-pedidos' && (
        <BestSellersManager />
      )}

      {/* Novities Manager — quando filtro Novidades está ativo */}
      {showNovitiesManager && selectedCategory === 'novidades' && (
        <NovitiesManager />
      )}

      {/* Lista de Produtos — oculta quando um manager especial está ativo */}
      {!showPromotionsManager && !showBestSellersManager && !showNovitiesManager && (filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">Nenhum produto encontrado no servidor.</p>
          
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleNew}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Adicionar Produto
            </button>

            {localProductsCount > 0 && (
              <button
                onClick={handleSyncLocal}
                className="text-amber-600 hover:text-amber-700 font-medium underline"
              >
                Sincronizar {localProductsCount} produtos locais
              </button>
            )}

            <button
              onClick={handleSeed}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Restaurar Produtos Padrão
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white border rounded-lg p-4 flex gap-4">
              {/* Imagem */}
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-5 h-5 text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-green-600">
                    R$ {product.price.toFixed(2)}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    product.available 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.available ? 'Disponível' : 'Indisponível'}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {categories.find(c => c.id === product.category)?.label || 
                     (product.category === 'promocoes' ? 'Promoções' : 
                      product.category === 'mais-pedidos' ? 'Mais Pedidos' : 
                      product.category === 'novidades' ? 'Novidades' : product.category)}
                  </span>
                  {stockEnabled && unavailableProducts.includes(product.id) && (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-red-200 text-red-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Sem Estoque
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Modal */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-green-600 text-white p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-green-700 p-1 rounded">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    required
                  />
                </div>

                {/* Descrição - oculta quando estoque ativado (ingredientes substituem) */}
                {!stockEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    rows={3}
                  />
                </div>
                )}

                {/* Preço e Categoria */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preço (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria *
                    </label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                      required
                    >
                      <option value="">Selecione...</option>
                      
                      <optgroup label="Sistema">
                        <option value="promocoes">Promoções</option>
                        <option value="mais-pedidos">Mais Pedidos</option>
                      </optgroup>
                      
                      <optgroup label="Menu">
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Upload de Imagem */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imagem do Produto
                  </label>
                  
                  {formData.imageUrl && (
                    <div className="mb-2">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="text-red-600 text-sm mt-1 hover:underline"
                      >
                        Remover imagem
                      </button>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                  />
                  {uploadingImage && (
                    <p className="text-sm text-gray-600 mt-1">Enviando imagem...</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Máximo 5MB</p>
                </div>

                {/* Disponibilidade */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.available}
                    onChange={e => setFormData({ ...formData, available: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Produto disponível
                  </label>
                </div>

                {/* === INGREDIENTES / FICHA TÉCNICA === */}
                {stockEnabled && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-600" />
                      Ficha Técnica (Ingredientes do Estoque)
                    </h4>

                    {/* Ingredientes do estoque selecionados */}
                    {recipeIngredients.length > 0 && (
                      <div className="space-y-2">
                        {recipeIngredients.map((ri, idx) => {
                          const ing = stockIngredients.find(s => s.id === ri.ingredientId);
                          const portions = ing?.portionOptions || [];
                          const hasPortion = !!ri.selectedPortionId;
                          const cat = ing?.category || 'ingredient';
                          const bgClass = cat === 'embalagem'
                            ? 'bg-amber-50 border-amber-200'
                            : cat === 'acompanhamento'
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-teal-50 border-teal-200';
                          return (
                            <div key={ri.ingredientId} className={`flex flex-col gap-1.5 border rounded-lg px-3 py-2 ${bgClass}`}>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-gray-800 text-sm">
                                    {ri.ingredientName || ing?.name || 'Ingrediente'}
                                  </span>
                                  {cat === 'embalagem' && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                      Embalagem
                                    </span>
                                  )}
                                  {cat === 'acompanhamento' && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                                      Acompanhamento
                                    </span>
                                  )}
                                  {hasPortion && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                                      {ri.selectedPortionLabel} ({ri.selectedPortionG}g)
                                    </span>
                                  )}
                                  {!hasPortion && ing?.type === 'kg' && cat === 'ingredient' && (
                                    <span className="text-xs text-gray-500 ml-1.5">(kg)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    min={ing?.type === 'unit' ? '1' : '0.01'}
                                    value={ri.quantityUsed}
                                    onChange={e => {
                                      const updated = [...recipeIngredients];
                                      updated[idx] = { ...updated[idx], quantityUsed: parseFloat(e.target.value) || 0 };
                                      setRecipeIngredients(updated);
                                    }}
                                    className="w-20 px-2 py-1 border rounded text-sm text-center bg-white text-gray-900"
                                    title={hasPortion ? `Cada porcao = ${ri.selectedPortionG}g` : 'Quantidade usada por produto'}
                                  />
                                  <span className="text-[10px] text-gray-400 w-8">
                                    {ing?.type === 'unit' ? 'un' : hasPortion ? 'porc.' : 'kg'}
                                  </span>
                                </div>
                                {/* Ocultar checkbox — só para ingredientes normais (embalagens/acomp. sempre ocultos) */}
                                {cat === 'ingredient' && (
                                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={ri.hideFromClient}
                                      onChange={e => {
                                        const updated = [...recipeIngredients];
                                        updated[idx] = { ...updated[idx], hideFromClient: e.target.checked };
                                        setRecipeIngredients(updated);
                                      }}
                                      className="w-3 h-3"
                                    />
                                    Ocultar
                                  </label>
                                )}
                                {(cat === 'embalagem' || cat === 'acompanhamento') && (
                                  <span className="text-[10px] text-gray-400 italic">oculto</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {/* Seletor de porcao — so aparece se o ingrediente tem opcoes de porcao */}
                              {portions.length > 0 && (
                                <div className="flex items-center gap-2 pl-1">
                                  <span className="text-[10px] text-gray-500 font-medium">Porcao:</span>
                                  <select
                                    value={ri.selectedPortionId || ''}
                                    onChange={e => {
                                      const updated = [...recipeIngredients];
                                      const portionId = e.target.value;
                                      if (portionId) {
                                        const portion = portions.find(p => p.id === portionId);
                                        if (portion) {
                                          updated[idx] = {
                                            ...updated[idx],
                                            selectedPortionId: portion.id,
                                            selectedPortionG: portion.grams,
                                            selectedPortionLabel: portion.label,
                                          };
                                        }
                                      } else {
                                        updated[idx] = {
                                          ...updated[idx],
                                          selectedPortionId: undefined,
                                          selectedPortionG: undefined,
                                          selectedPortionLabel: undefined,
                                        };
                                      }
                                      setRecipeIngredients(updated);
                                    }}
                                    className="flex-1 px-2 py-1 border rounded text-xs bg-white text-gray-900"
                                  >
                                    <option value="">Sem porcao (usar kg direto)</option>
                                    {portions.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.label} — {p.grams}g ({Math.round(1000 / p.grams)} porc./kg)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Seletor multi-selecao para ingredientes */}
                    {(() => {
                      const availableIngredients = stockIngredients
                        .filter(s => (!s.category || s.category === 'ingredient') && !recipeIngredients.some(r => r.ingredientId === s.id));
                      const filteredAvailable = ingredientSearch.trim()
                        ? availableIngredients.filter(s => s.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
                        : availableIngredients;
                      const addedCount = recipeIngredients.filter(ri => {
                        const ing = stockIngredients.find(s => s.id === ri.ingredientId);
                        return !ing?.category || ing.category === 'ingredient';
                      }).length;

                      const toggleIngredient = (ing: StockIngredient) => {
                        const exists = recipeIngredients.some(r => r.ingredientId === ing.id);
                        if (exists) {
                          setRecipeIngredients(recipeIngredients.filter(r => r.ingredientId !== ing.id));
                        } else {
                          const portions = ing.portionOptions || [];
                          const defaultPortion = portions.length === 1 ? portions[0] : null;
                          setRecipeIngredients([...recipeIngredients, {
                            ingredientId: ing.id,
                            ingredientName: ing.name,
                            quantityUsed: 1,
                            hideFromClient: false,
                            ...(defaultPortion ? {
                              selectedPortionId: defaultPortion.id,
                              selectedPortionG: defaultPortion.grams,
                              selectedPortionLabel: defaultPortion.label,
                            } : {}),
                          }]);
                        }
                      };

                      return (
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setIngredientPickerOpen(!ingredientPickerOpen);
                              setIngredientSearch('');
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                              ingredientPickerOpen
                                ? 'border-teal-500 bg-teal-50 text-teal-800'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300 hover:bg-teal-50/50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              Selecionar Ingredientes
                              {addedCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">{addedCount}</span>
                              )}
                            </span>
                            {ingredientPickerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {ingredientPickerOpen && (
                            <div className="mt-2 border-2 border-teal-200 rounded-lg bg-white overflow-hidden">
                              {/* Busca */}
                              <div className="p-2 border-b border-teal-100 bg-teal-50/30">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Buscar ingrediente..."
                                    value={ingredientSearch}
                                    onChange={e => setIngredientSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 border rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                    autoFocus
                                  />
                                </div>
                              </div>

                              {/* Lista de ingredientes */}
                              <div className="max-h-52 overflow-y-auto p-1.5">
                                {filteredAvailable.length === 0 && addedCount === 0 && (
                                  <p className="text-xs text-gray-500 text-center py-4">Nenhum ingrediente disponivel</p>
                                )}

                                {/* Ingredientes ja adicionados (marcados) */}
                                {stockIngredients
                                  .filter(s => (!s.category || s.category === 'ingredient') && recipeIngredients.some(r => r.ingredientId === s.id))
                                  .filter(s => !ingredientSearch.trim() || s.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
                                  .map(s => {
                                    const stockDisplay = s.type === 'kg' ? `${s.currentStock.toFixed(2)}kg` : `${Math.floor(s.currentStock)}un`;
                                    const portionCount = (s.portionOptions || []).length;
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => toggleIngredient(s)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-all bg-teal-50 hover:bg-teal-100 mb-0.5"
                                      >
                                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 bg-teal-600 border-teal-600">
                                          <span className="text-white text-[9px] font-bold">✓</span>
                                        </div>
                                        <span className="flex-1 font-medium text-teal-900">{s.name}</span>
                                        <span className="text-[10px] text-teal-600 font-medium">{stockDisplay}</span>
                                        {portionCount > 0 && (
                                          <span className="text-[10px] text-teal-500 bg-teal-100 px-1.5 py-0.5 rounded">{portionCount} porc.</span>
                                        )}
                                      </button>
                                    );
                                  })
                                }

                                {/* Ingredientes disponiveis (nao marcados) */}
                                {filteredAvailable.map(s => {
                                  const stockDisplay = s.type === 'kg' ? `${s.currentStock.toFixed(2)}kg` : `${Math.floor(s.currentStock)}un`;
                                  const portionCount = (s.portionOptions || []).length;
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => toggleIngredient(s)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-all hover:bg-gray-50 mb-0.5"
                                    >
                                      <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
                                      <span className="flex-1 text-gray-800">{s.name}</span>
                                      <span className="text-[10px] text-gray-500 font-medium">{stockDisplay}</span>
                                      {portionCount > 0 && (
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{portionCount} porc.</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Rodape com contagem */}
                              <div className="px-3 py-2 border-t border-teal-100 bg-teal-50/30 flex items-center justify-between">
                                <span className="text-[10px] text-teal-700 font-medium">
                                  {addedCount} selecionado{addedCount !== 1 ? 's' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIngredientPickerOpen(false)}
                                  className="text-xs text-teal-700 font-bold hover:text-teal-900 px-3 py-1 rounded-md hover:bg-teal-100 transition-colors"
                                >
                                  Fechar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Seletores de Embalagens e Acompanhamentos */}
                    {(() => {
                      const embalagens = stockIngredients.filter(s => s.category === 'embalagem');
                      const acompanhamentos = stockIngredients.filter(s => s.category === 'acompanhamento');
                      const hasEmbalagens = embalagens.length > 0;
                      const hasAcompanhamentos = acompanhamentos.length > 0;
                      if (!hasEmbalagens && !hasAcompanhamentos) return null;

                      const toggleItem = (ing: StockIngredient) => {
                        const exists = recipeIngredients.some(r => r.ingredientId === ing.id);
                        if (exists) {
                          setRecipeIngredients(recipeIngredients.filter(r => r.ingredientId !== ing.id));
                        } else {
                          setRecipeIngredients([...recipeIngredients, {
                            ingredientId: ing.id,
                            ingredientName: ing.name,
                            quantityUsed: ing.category === 'acompanhamento' ? (ing.defaultQuantity || 1) : 1,
                            hideFromClient: true,
                          }]);
                        }
                      };

                      return (
                        <div className="space-y-3">
                          {/* Embalagens */}
                          {hasEmbalagens && (
                            <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                              <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                                <BoxSelect className="w-3.5 h-3.5" />
                                Embalagens
                                <span className="text-[10px] font-normal text-amber-600 ml-1">(ocultas do cliente, descontadas em entrega/retirada)</span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {embalagens.map(emb => {
                                  const isAdded = recipeIngredients.some(r => r.ingredientId === emb.id);
                                  return (
                                    <button
                                      key={emb.id}
                                      type="button"
                                      onClick={() => toggleItem(emb)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                                        isAdded
                                          ? 'bg-amber-200 text-amber-900 border-amber-400'
                                          : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100'
                                      }`}
                                    >
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                                        isAdded ? 'bg-amber-600 border-amber-600' : 'border-amber-400'
                                      }`}>
                                        {isAdded && <span className="text-white text-[8px] font-bold">✓</span>}
                                      </div>
                                      {emb.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Acompanhamentos */}
                          {hasAcompanhamentos && (
                            <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-3">
                              <p className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1.5">
                                <Utensils className="w-3.5 h-3.5" />
                                Acompanhamentos / Molhos
                                <span className="text-[10px] font-normal text-indigo-600 ml-1">(cliente escolhe no checkout)</span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {acompanhamentos.map(acomp => {
                                  const isAdded = recipeIngredients.some(r => r.ingredientId === acomp.id);
                                  return (
                                    <button
                                      key={acomp.id}
                                      type="button"
                                      onClick={() => toggleItem(acomp)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                                        isAdded
                                          ? 'bg-indigo-200 text-indigo-900 border-indigo-400'
                                          : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                      }`}
                                    >
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                                        isAdded ? 'bg-indigo-600 border-indigo-600' : 'border-indigo-400'
                                      }`}>
                                        {isAdded && <span className="text-white text-[8px] font-bold">✓</span>}
                                      </div>
                                      {acomp.name}
                                      {acomp.defaultQuantity && (
                                        <span className="text-[10px] opacity-60">({acomp.defaultQuantity}/ped)</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Ingredientes extras (sem controle de estoque) */}
                    <h4 className="font-bold text-gray-800 text-sm mt-4">
                      Ingredientes Extras (sem controle de estoque)
                    </h4>
                    {extraIngredients.length > 0 && (
                      <div className="space-y-2">
                        {extraIngredients.map((extra, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <input
                              type="text"
                              value={extra.name}
                              onChange={e => {
                                const updated = [...extraIngredients];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setExtraIngredients(updated);
                              }}
                              className="flex-1 px-2 py-1 border rounded text-sm bg-white text-gray-900"
                              placeholder="Nome do ingrediente"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={extra.hideFromClient}
                                onChange={e => {
                                  const updated = [...extraIngredients];
                                  updated[idx] = { ...updated[idx], hideFromClient: e.target.checked };
                                  setExtraIngredients(updated);
                                }}
                                className="w-3 h-3"
                              />
                              Ocultar
                            </label>
                            <button
                              type="button"
                              onClick={() => setExtraIngredients(extraIngredients.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setExtraIngredients([...extraIngredients, { name: '', hideFromClient: false }])}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar ingrediente extra
                    </button>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingProduct ? 'Atualizar' : 'Criar'} Produto
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}