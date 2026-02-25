import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save, Loader, Search, Percent, Package, Image as ImageIcon } from 'lucide-react';
import * as api from '../../utils/api';
import type { Product } from '../../App';

export interface PromoItem {
  productId: string;
  productName: string;
  originalPrice: number;
  imageUrl?: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  price: number; // Preco promocional
  category: 'promocoes';
  available: boolean;
  imageUrl?: string | null;
  promoItems: PromoItem[]; // Produtos inclusos na promocao
  originalTotal: number; // Soma dos precos originais
  createdAt?: string;
}

interface PromotionsManagerProps {
  onProductsChange: () => void;
}

export function PromotionsManager({ onProductsChange }: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  // Form state
  const [promoName, setPromoName] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [promoImageUrl, setPromoImageUrl] = useState('');
  const [promoAvailable, setPromoAvailable] = useState(true);
  const [selectedItems, setSelectedItems] = useState<PromoItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAllProducts();
      if (res.success) {
        const all = res.products || [];
        // Separar promocoes e produtos normais
        setPromotions(all.filter((p: any) => p.category === 'promocoes' && p.promoItems));
        setAllProducts(all.filter((p: any) => p.category !== 'promocoes'));
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setEditingPromo(null);
    setPromoName('');
    setPromoPrice('');
    setPromoImageUrl('');
    setPromoAvailable(true);
    setSelectedItems([]);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setPromoName(promo.name);
    setPromoPrice(promo.price.toString());
    setPromoImageUrl(promo.imageUrl || '');
    setPromoAvailable(promo.available);
    setSelectedItems(promo.promoItems || []);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja deletar esta promoção?')) return;
    try {
      await api.deleteProduct(id);
      await loadData();
      onProductsChange();
      alert('Promoção deletada com sucesso!');
    } catch (err) {
      console.error('Erro ao deletar promoção:', err);
      alert('Erro ao deletar promoção');
    }
  };

  const toggleProduct = (product: Product) => {
    const exists = selectedItems.find(i => i.productId === product.id);
    if (exists) {
      setSelectedItems(selectedItems.filter(i => i.productId !== product.id));
    } else {
      setSelectedItems([...selectedItems, {
        productId: product.id,
        productName: product.name,
        originalPrice: product.price,
        imageUrl: product.imageUrl,
      }]);
    }
  };

  const originalTotal = selectedItems.reduce((sum, i) => sum + i.originalPrice, 0);
  const promoPriceNum = parseFloat(promoPrice) || 0;
  const discount = originalTotal > 0 ? Math.round(((originalTotal - promoPriceNum) / originalTotal) * 100) : 0;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande! Máximo 5MB');
      return;
    }
    try {
      setUploadingImage(true);
      const res = await api.uploadProductImage(file);
      if (res.success && res.url) {
        setPromoImageUrl(res.url);
      } else {
        alert('Erro ao fazer upload da imagem');
      }
    } catch (err) {
      console.error('Erro no upload:', err);
      alert('Erro ao fazer upload da imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!promoName.trim()) {
      alert('Preencha o nome da promoção');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Selecione pelo menos um produto para a promoção');
      return;
    }
    if (!promoPrice || promoPriceNum <= 0) {
      alert('Defina um preço promocional válido');
      return;
    }

    // Gerar descricao automatica
    const itemsDesc = selectedItems.map(i => i.productName).join(' + ');
    const description = `${itemsDesc} — De R$ ${originalTotal.toFixed(2).replace('.', ',')} por R$ ${promoPriceNum.toFixed(2).replace('.', ',')}`;

    const promoData: any = {
      name: promoName.trim(),
      description,
      price: promoPriceNum,
      category: 'promocoes',
      available: promoAvailable,
      imageUrl: promoImageUrl || (selectedItems[0]?.imageUrl || null),
      promoItems: selectedItems,
      originalTotal,
    };

    try {
      if (editingPromo) {
        const res = await api.updateProduct(editingPromo.id, promoData);
        if (res.success) alert('Promoção atualizada!');
      } else {
        const res = await api.createProduct(promoData);
        if (res.success) alert('Promoção criada!');
      }
      setIsModalOpen(false);
      await loadData();
      onProductsChange();
    } catch (err) {
      console.error('Erro ao salvar promoção:', err);
      alert('Erro ao salvar promoção');
    }
  };

  // Filtrar produtos para busca (excluir os ja selecionados se quiser, ou marcar como selecionados)
  const filteredProducts = productSearch.trim()
    ? allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : allProducts;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Percent className="w-6 h-6 text-red-600" />
            Gerenciar Promoções
          </h2>
          <p className="text-gray-600">Total: {promotions.length} promoções ativas</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          Nova Promoção
        </button>
      </div>

      {/* Lista de Promoções */}
      {promotions.length === 0 ? (
        <div className="text-center py-12 bg-red-50 rounded-lg border-2 border-dashed border-red-200">
          <Percent className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">Nenhuma promoção criada ainda</p>
          <p className="text-gray-500 text-sm mb-4">Crie promoções combinando seus produtos com preços especiais!</p>
          <button
            onClick={handleNew}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Criar Primeira Promoção
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {promotions.map(promo => {
            const discountPct = promo.originalTotal > 0
              ? Math.round(((promo.originalTotal - promo.price) / promo.originalTotal) * 100)
              : 0;
            return (
              <div key={promo.id} className="bg-white border border-red-200 rounded-lg p-4 flex gap-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Imagem */}
                <div className="w-24 h-24 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-red-100">
                  {promo.imageUrl ? (
                    <img src={promo.imageUrl} alt={promo.name} className="w-full h-full object-cover" />
                  ) : (
                    <Percent className="w-8 h-8 text-red-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-800 truncate">{promo.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {promo.promoItems?.map((item, idx) => (
                          <span key={idx} className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {item.productName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleEdit(promo)}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-500 line-through">
                      R$ {promo.originalTotal.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-lg font-bold text-red-600">
                      R$ {promo.price.toFixed(2).replace('.', ',')}
                    </span>
                    {discountPct > 0 && (
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        -{discountPct}%
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      promo.available
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {promo.available ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar Promoção */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="bg-red-600 text-white p-4 flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  {editingPromo ? 'Editar Promoção' : 'Nova Promoção'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-red-700 p-1 rounded">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Nome da Promoção */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Promoção *
                  </label>
                  <input
                    type="text"
                    value={promoName}
                    onChange={e => setPromoName(e.target.value)}
                    placeholder="Ex: Combo Família, Promoção do Dia..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900"
                    required
                  />
                </div>

                {/* Selecionar Produtos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produtos da Promoção *
                  </label>

                  {/* Produtos selecionados */}
                  {selectedItems.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {selectedItems.map((item, idx) => (
                        <div key={item.productId} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <span className="flex-1 font-medium text-gray-800 text-sm">{item.productName}</span>
                          <span className="text-sm text-gray-600">
                            R$ {item.originalPrice.toFixed(2).replace('.', ',')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-600">Total original:</span>
                        <span className="text-sm font-bold text-gray-800">
                          R$ {originalTotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Buscar e adicionar produtos */}
                  <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-2 bg-gray-50 border-b">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar produto..."
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 border rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto p-1.5">
                      {filteredProducts.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">Nenhum produto encontrado</p>
                      ) : (
                        filteredProducts.map(product => {
                          const isSelected = selectedItems.some(i => i.productId === product.id);
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => toggleProduct(product)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-all mb-0.5 ${
                                isSelected
                                  ? 'bg-red-50 hover:bg-red-100'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-red-600 border-red-600' : 'border-gray-300'
                              }`}>
                                {isSelected && <span className="text-white text-[9px] font-bold">&#10003;</span>}
                              </div>
                              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-3 h-3 text-gray-400" />
                                )}
                              </div>
                              <span className={`flex-1 ${isSelected ? 'font-medium text-red-900' : 'text-gray-800'}`}>
                                {product.name}
                              </span>
                              <span className="text-xs text-gray-500 font-medium">
                                R$ {product.price.toFixed(2).replace('.', ',')}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-600">
                      {selectedItems.length} produto{selectedItems.length !== 1 ? 's' : ''} selecionado{selectedItems.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Preço Promocional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço Promocional (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={promoPrice}
                    onChange={e => setPromoPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900"
                    required
                  />

                  {/* Preview do desconto */}
                  {selectedItems.length > 0 && promoPriceNum > 0 && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Original:</span>
                          <span className="line-through text-gray-500">R$ {originalTotal.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Promoção:</span>
                          <span className="font-bold text-red-600">R$ {promoPriceNum.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                      {discount > 0 ? (
                        <div className="bg-red-600 text-white px-3 py-2 rounded-lg text-center">
                          <div className="text-2xl font-black">-{discount}%</div>
                          <div className="text-[10px] uppercase tracking-wide">desconto</div>
                        </div>
                      ) : (
                        <div className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-center">
                          <div className="text-sm font-medium">Sem desconto</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Imagem */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imagem da Promoção (opcional)
                  </label>
                  {promoImageUrl && (
                    <div className="mb-2">
                      <img src={promoImageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => setPromoImageUrl('')}
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900"
                  />
                  {uploadingImage && <p className="text-sm text-gray-600 mt-1">Enviando imagem...</p>}
                  <p className="text-xs text-gray-500 mt-1">Se não enviar, usará a imagem do primeiro produto</p>
                </div>

                {/* Disponibilidade */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={promoAvailable}
                    onChange={e => setPromoAvailable(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Promoção ativa
                  </label>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    {editingPromo ? 'Atualizar' : 'Criar'} Promoção
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
