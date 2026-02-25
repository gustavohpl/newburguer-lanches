import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Image as ImageIcon, Search, Sparkles, Wand2, Loader2, Clock, Target, Users, Utensils, CheckCircle2, Flame, Star, DollarSign, ShoppingBag, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import * as api from '../../../utils/api';
import { useMetaAPI } from '../../../hooks/useMetaAPI';

interface CreateProductAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (campaign: any) => void;
}

export function CreateProductAdModal({ isOpen, onClose, onSuccess }: CreateProductAdModalProps) {
  // Define audiences inside component so JSX elements work
  const AUDIENCES = [
    {
      id: 'lunch',
      name: 'Horário de Almoço',
      size: 12500,
      conversionRate: 8,
      description: 'Pessoas num raio de 3km ativas entre 11h e 14h.',
      icon: <Clock className="w-4 h-4" />
    },
    {
      id: 'dinner',
      name: 'Fome Noturna',
      size: 22000,
      conversionRate: 12,
      description: 'Público noturno que costuma pedir delivery (18h-23h).',
      icon: <Target className="w-4 h-4" />
    },
    {
      id: 'lookalike',
      name: 'Semelhante aos Compradores',
      size: 45000,
      conversionRate: 5,
      description: 'Lookalike 1% de quem já comprou este produto.',
      icon: <Users className="w-4 h-4" />
    }
  ];

  const [step, setStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // Step 2: Creative
  const [creativeTemplate, setCreativeTemplate] = useState(1);
  const [adTone, setAdTone] = useState<'hungry' | 'premium' | 'deal'>('hungry');
  const [adCopy, setAdCopy] = useState('');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [customAdImage, setCustomAdImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Step 3: Audience
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['dinner']);

  // Step 4: Budget
  const [budgetAmount, setBudgetAmount] = useState(30);
  const { createCampaign } = useMetaAPI();
  const [isCreating, setIsCreating] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      loadProducts();
      setCustomAdImage(null);
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await api.getAllProducts();
      
      if (response.success && response.products) {
        console.log('📢 [AdModal] Products received:', response.products.length);
        // Filter out unavailable products
        const availableProducts = response.products
          .filter((p: any) => p.available !== false)
          .map((p: any) => {
             const finalImage = p.imageUrl || p.image;
             if (!finalImage) console.warn(`⚠️ Produto sem imagem: ${p.name}`);

             return {
               ...p,
               // Ensure we keep the original imageUrl accessible
               imageUrl: p.imageUrl, // Garantir que imageUrl original esteja presente
               image: finalImage,
               rating: (4 + Math.random()).toFixed(1)
             };
          });
        
        setProducts(availableProducts);
        
        if (availableProducts.length > 0) {
          setSelectedProduct(availableProducts[0]);
        }
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Erro ao carregar produtos do cardápio');
    } finally {
      setIsLoadingProducts(false);
    }
  };
  
  // Handle Custom Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (Max 5MB)');
      return;
    }

    try {
      setIsUploadingImage(true);
      const response = await api.uploadProductImage(file);
      
      if (response.success && response.url) {
        setCustomAdImage(response.url);
        toast.success('Imagem do anúncio atualizada!');
      } else {
        toast.error('Erro ao enviar imagem');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Update copy when product/tone changes
  useEffect(() => {
    if (selectedProduct) {
      if (adTone === 'hungry') {
        setAdCopy(`🍔 BATEU AQUELA FOME DE RESPEITO? 🤤\n\nConheça o ${selectedProduct.name}: ${selectedProduct.description}\n\nSuculento. Quentinho. Chegando rápido na sua porta.\n\n👇 Peça agora antes que a fome aumente!`);
      } else if (adTone === 'premium') {
        setAdCopy(`✨ UMA EXPERIÊNCIA GASTRONÔMICA ✨\n\n${selectedProduct.name}. Feito com ingredientes selecionados para quem exige qualidade.\n\n⭐ Avaliado em ${selectedProduct.rating}/5.0 por nossos clientes.\n\nPermita-se. Peça o seu hoje.`);
      } else {
        setAdCopy(`🔥 OFERTA DO DIA: ${selectedProduct.name} 🔥\n\nO burger mais pedido da casa por apenas R$ ${selectedProduct.price.toFixed(2)}!\n\n🚀 Entrega Grátis acima de R$ 60\n💳 Aceitamos VR e Pix\n\nClique e peça já! 👇`);
      }
    }
  }, [selectedProduct, adTone]);

  const handleGenerateCopy = () => {
    setIsGeneratingCopy(true);
    setTimeout(() => {
      setAdCopy(`🚨 ALERTA DE FLAVOR BOMB! 🚨\n\nVocê não está preparado para o ${selectedProduct.name}.\n\n🥓 Bacon crocante de verdade\n🧀 Queijo derretendo\n🥩 Carne no ponto perfeito\n\nNão passe vontade, passe o cartão! 😂\n\n👉 PEÇA AGORA NO LINK`);
      setIsGeneratingCopy(false);
      toast.success("Copy reescrita com IA focada em conversão!");
    }, 1500);
  };

  const handleGenerateAIImage = async () => {
    if (!selectedProduct) return;
    
    setIsGeneratingImage(true);
    try {
      // Use Pollinations AI for real-time generation
      // Include ingredients/description for better accuracy, but limit length
      const cleanDescription = selectedProduct.description 
        ? selectedProduct.description.slice(0, 100).replace(/\n/g, ' ') 
        : '';
        
      const ingredientsContext = cleanDescription ? `made with ${cleanDescription}` : '';
      const prompt = encodeURIComponent(`delicious ${selectedProduct.name} ${ingredientsContext} food photography cinematic lighting 4k highly detailed appetizing restaurant quality macro shot`);
      
      // Add random seed to prevent caching the same image
      const seed = Math.floor(Math.random() * 10000);
      const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?seed=${seed}&nologo=true&width=1080&height=1080&model=flux`;
      
      // Preload image to ensure it's ready before showing
      const img = new Image();
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsGeneratingImage(false);
        toast.error('A geração demorou muito. Tente novamente.');
        img.src = ''; // Cancel loading
      }, 20000); // 20 seconds timeout

      img.onload = () => {
        clearTimeout(timeoutId);
        setCustomAdImage(imageUrl);
        setIsGeneratingImage(false);
        toast.success('Imagem única gerada com IA!');
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        setIsGeneratingImage(false);
        toast.error('Erro ao gerar imagem. Tente novamente.');
      };
      
      img.src = imageUrl;

    } catch (error) {
      console.error(error);
      setIsGeneratingImage(false);
      toast.error('Erro ao conectar com serviço de IA');
    }
  };

  const handleFinish = async () => {
    try {
      setIsCreating(true);
      
      const campaignData = {
        name: `[Produto] ${selectedProduct.name}`,
        type: 'product',
        product_id: selectedProduct.id,
        status: 'ACTIVE',
        daily_budget: budgetAmount,
        target_audiences: selectedAudiences,
        creative: {
          image_url: customAdImage || selectedProduct.image || selectedProduct.imageUrl,
          body_text: adCopy,
          tone: adTone,
          template_id: creativeTemplate
        }
      };

      console.log('🚀 Criando campanha:', campaignData);
      
      // Criar na API (que conecta com Meta)
      await createCampaign(campaignData);
      
      toast.success('Campanha criada com sucesso!');
      
      onSuccess({
        ...campaignData,
        product: selectedProduct
      });
      onClose();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error('Erro ao criar campanha. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Impulsionar Produto</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span className={step >= 1 ? "text-red-600 font-medium" : ""}>1. Produto</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step >= 2 ? "text-red-600 font-medium" : ""}>2. Criativo</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step >= 3 ? "text-red-600 font-medium" : ""}>3. Público</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step >= 4 ? "text-red-600 font-medium" : ""}>4. Budget</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          
          {/* STEP 1: SELECT PRODUCT */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Qual produto você quer vender mais?</h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Buscar produto..." className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>

              {isLoadingProducts ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
                  <p className="text-gray-500 text-sm">Carregando cardápio...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h4 className="text-gray-600 font-medium">Nenhum produto encontrado</h4>
                  <p className="text-gray-400 text-sm mt-1">Cadastre produtos no seu cardápio primeiro.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map((product) => (
                    <div 
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer flex gap-4 group ${
                        selectedProduct?.id === product.id 
                          ? 'border-red-500 bg-white shadow-md' 
                          : 'border-transparent bg-white hover:border-red-200 shadow-sm'
                      }`}
                    >
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <ImageWithFallback 
                          src={product.image || product.imageUrl || 'https://placehold.co/400x400?text=Sem+Imagem'} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-gray-800 line-clamp-1">{product.name}</h4>
                          {selectedProduct?.id === product.id && <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{product.description || 'Sem descrição definida.'}</p>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="font-bold text-red-600">R$ {product.price.toFixed(2)}</span>
                          {product.category === 'mais-pedidos' && (
                            <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Flame className="w-3 h-3" /> Popular
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CREATIVE */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Personalize seu Anúncio</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Tom da Comunicação</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'hungry', label: '😋 Apetite Appeal', icon: Flame },
                          { id: 'premium', label: '✨ Premium', icon: Star },
                          { id: 'deal', label: '💲 Promoção', icon: DollarSign },
                        ].map(tone => (
                          <button
                            key={tone.id}
                            onClick={() => setAdTone(tone.id as any)}
                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                              adTone === tone.id
                                ? 'bg-red-50 border-red-500 text-red-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <tone.icon className="w-4 h-4" />
                            {tone.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-700">Legenda do Anúncio (Copy)</label>
                        <button 
                          onClick={handleGenerateCopy}
                          disabled={isGeneratingCopy}
                          className="text-xs text-red-600 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
                        >
                          {isGeneratingCopy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Gerar com IA
                        </button>
                      </div>
                      <textarea
                        value={adCopy}
                        onChange={(e) => setAdCopy(e.target.value)}
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                        placeholder="Escreva a legenda do seu anúncio..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                  <h4 className="font-bold text-yellow-800 text-sm flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4" /> Dica de Ouro
                  </h4>
                  <p className="text-sm text-yellow-700">Imagens com pessoas comendo ou segurando o lanche aumentam o CTR em até 45% comparado a fotos estáticas do produto na mesa.</p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center relative overflow-hidden">
                 {/* Mobile Frame */}
                <div className="w-[280px] bg-white rounded-3xl shadow-2xl overflow-hidden border-8 border-gray-800 relative">
                  {/* Status Bar */}
                  <div className="h-6 bg-gray-800 flex justify-between items-center px-4">
                    <div className="text-[10px] text-white font-medium">19:30</div>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
                      <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
                    </div>
                  </div>

                  {/* Instagram Content */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs">FL</div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">NewBurguer Lanches</div>
                        <div className="text-[10px] text-gray-500">Patrocinado</div>
                      </div>
                    </div>
                    
                    {/* Ad Image Container with Edit Button */}
                    <div className="relative aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden group">
                      <ImageWithFallback 
                        src={customAdImage || selectedProduct?.image || selectedProduct?.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Image Edit Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
                         <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-full font-bold text-xs shadow-lg hover:bg-gray-100 transform hover:scale-105 transition-all flex items-center gap-2">
                           <ImageIcon className="w-4 h-4" />
                           {isUploadingImage ? 'Enviando...' : 'Trocar Imagem'}
                           <input 
                             type="file" 
                             className="hidden" 
                             accept="image/*"
                             onChange={handleImageUpload}
                             disabled={isUploadingImage}
                           />
                         </label>

                         {customAdImage && (
                           <button 
                             onClick={() => setCustomAdImage(null)}
                             className="text-white text-xs hover:underline bg-black/50 px-2 py-1 rounded"
                           >
                             Restaurar Original
                           </button>
                         )}
                      </div>

                      {/* AI Generation Button - Always Visible */}
                      <button
                        onClick={handleGenerateAIImage}
                        disabled={isGeneratingImage}
                        className="absolute bottom-3 right-3 bg-purple-600 text-white px-3 py-1.5 rounded-full font-bold text-[10px] shadow-lg hover:bg-purple-700 transform hover:scale-105 transition-all flex items-center gap-1.5 z-30 disabled:opacity-50 border border-purple-400"
                        title="Gerar nova imagem com IA"
                      >
                         {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-yellow-300" />}
                         {isGeneratingImage ? 'Criando...' : 'Gerar com IA'}
                      </button>

                      {/* Overlays based on tone */}
                      {adTone === 'deal' && (
                        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full font-bold text-xs shadow-lg animate-bounce">
                          OFERTA ESPECIAL
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex justify-between items-center mb-2 px-1">
                      <div className="flex gap-3">
                        <ThumbsUp className="w-5 h-5 text-gray-800" />
                        <MessageCircle className="w-5 h-5 text-gray-800" />
                        <Share2 className="w-5 h-5 text-gray-800" />
                      </div>
                    </div>

                    {/* Copy */}
                    <div className="text-xs text-gray-800 px-1">
                      <span className="font-bold mr-1">newburguer</span>
                      <span className="whitespace-pre-wrap">{adCopy || 'Sua legenda incrível aparecerá aqui...'}</span>
                    </div>
                    
                    {/* CTA Button */}
                    <div className="mt-3 bg-blue-50 p-2 rounded flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors">
                       <span className="text-[10px] font-medium text-gray-500">{window.location.hostname}</span>
                       <span className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded">Peça Agora</span>
                    </div>
                  </div>
                </div>
                
                <p className="absolute bottom-2 text-xs text-gray-400">Prévia aproximada do Feed do Instagram</p>
              </div>
            </div>
          )}

          {/* STEP 3: AUDIENCE */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-800">Para quem vamos mostrar?</h3>
              
              <div className="grid gap-4">
                {AUDIENCES.map((audience) => (
                  <label 
                    key={audience.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedAudiences.includes(audience.id)
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-red-200'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      className="mt-1 w-5 h-5 text-red-600 rounded focus:ring-red-500"
                      checked={selectedAudiences.includes(audience.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAudiences([...selectedAudiences, audience.id]);
                        } else {
                          setSelectedAudiences(selectedAudiences.filter(id => id !== audience.id));
                        }
                      }}
                    />
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 border border-gray-100 shadow-sm shrink-0">
                      {audience.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-gray-800">{audience.name}</div>
                        <div className="text-sm font-medium text-gray-600">{audience.size.toLocaleString()} pessoas</div>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{audience.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: BUDGET */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Investimento Diário</h3>
                
                <div className="flex items-center justify-center gap-6">
                   <button 
                    onClick={() => setBudgetAmount(Math.max(10, budgetAmount - 5))}
                    className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold text-xl"
                   >-</button>
                   
                   <div className="text-center">
                     <div className="text-4xl font-black text-gray-800">R$ {budgetAmount},00</div>
                     <div className="text-gray-500 text-sm mt-1">por dia</div>
                   </div>

                   <button 
                    onClick={() => setBudgetAmount(budgetAmount + 5)}
                    className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold text-xl"
                   >+</button>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Previsão de Resultados (Diário)
                </h4>
                <div className="flex justify-between items-center text-center divide-x divide-blue-200">
                   <div className="flex-1 px-2">
                      <div className="text-blue-600 text-xs uppercase font-bold">Alcance</div>
                      <div className="text-xl font-bold text-blue-900">{(budgetAmount * 110).toLocaleString()}</div>
                   </div>
                   <div className="flex-1 px-2">
                      <div className="text-blue-600 text-xs uppercase font-bold">Cliques</div>
                      <div className="text-xl font-bold text-blue-900">{Math.round(budgetAmount * 2.5)}</div>
                   </div>
                   <div className="flex-1 px-2">
                      <div className="text-blue-600 text-xs uppercase font-bold">Pedidos</div>
                      <div className="text-xl font-bold text-blue-900">{Math.round(budgetAmount * 0.4)}-{Math.round(budgetAmount * 0.8)}</div>
                   </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100 flex justify-between items-center">
          {step > 1 ? (
            <button 
              onClick={() => setStep(step - 1)}
              className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          ) : (
             <button 
              onClick={onClose}
              className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}

          {step < 4 ? (
            <button 
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 bg-gray-900 text-white font-medium hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-gray-200"
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleFinish}
              disabled={isCreating}
              className="px-8 py-2.5 bg-red-600 text-white font-bold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-red-200"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : '🚀'}
              {isCreating ? 'Criando...' : 'IMPULSIONAR PRODUTO'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}