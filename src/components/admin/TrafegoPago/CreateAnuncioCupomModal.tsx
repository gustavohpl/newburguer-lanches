import React, { useState } from 'react';
import { X, ChevronRight, Check, Image as ImageIcon, Percent, DollarSign, Tag } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useMetaAPI } from '../../../hooks/useMetaAPI';

interface CreateAnuncioCupomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  coupons?: any[]; // Pass existing coupons
}

export function CreateAnuncioCupomModal({ isOpen, onClose, onSuccess, coupons = [] }: CreateAnuncioCupomModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { createCampaign } = useMetaAPI();

  const [formData, setFormData] = useState({
    couponCode: '',
    discountValue: 10,
    discountType: 'percentage', // percentage or fixed
    
    // Audience Strategy
    strategy: 'CART_ABANDONMENT', // CART_ABANDONMENT, VISITORS_NO_PURCHASE, NEW_CUSTOMERS
    
    // Creative
    headline: 'Ganhe desconto no seu pedido! 🍔',
    cta: 'GET_OFFER',
    
    // Budget
    totalBudget: 50,
    days: 3,
  });

  const strategies = [
    { 
      id: 'CART_ABANDONMENT', 
      title: 'Carrinho Abandonado', 
      desc: 'Clientes que adicionaram itens mas não compraram',
      potential: 'Alta Conversão'
    },
    { 
      id: 'VISITORS_NO_PURCHASE', 
      title: 'Visitantes sem Compra', 
      desc: 'Pessoas que visitaram o site nos últimos 30 dias',
      potential: 'Média Conversão'
    },
    { 
      id: 'NEW_CUSTOMERS', 
      title: 'Novos Clientes', 
      desc: 'Pessoas na região que nunca compraram',
      potential: 'Alto Volume'
    }
  ];

  if (!isOpen) return null;

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Auto-generate campaign logic
      const campaignName = `[CUPOM] ${formData.couponCode} - ${formData.strategy}`;
      
      // Create campaign via API
      await createCampaign({
        name: campaignName,
        objective: 'OUTCOME_SALES',
        daily_budget: Math.round((formData.totalBudget / formData.days) * 100),
        status: 'ACTIVE',
        special_ad_category: 'NONE',
        targeting: {
             // Mock targeting logic based on strategy
             custom_audiences: [formData.strategy] 
        },
        creative: {
            headline: formData.headline,
            body: `Use o cupom ${formData.couponCode} e garanta seu desconto hoje! Válido por tempo limitado.`,
            link_data: {
                link: `${window.location.origin}?cupom=${formData.couponCode}&utm_source=facebook&utm_medium=paid&utm_campaign=${campaignName.replace(/\s+/g, '_').toLowerCase()}`
            }
        }
      });
      
      toast.success('Anúncio de cupom criado com sucesso!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar anúncio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Tag className="text-white/80" />
                    Criar Anúncio de Cupom
                </h2>
                <p className="text-white/80 text-sm mt-1">Automatize vendas com descontos estratégicos</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white">
                <X size={20} />
            </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto">
            
            {/* Step 1: Cupom Info */}
            <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Configurar Cupom
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Código do Cupom</label>
                        <input 
                            type="text" 
                            value={formData.couponCode}
                            onChange={e => setFormData({...formData, couponCode: e.target.value.toUpperCase()})}
                            placeholder="Ex: SEXTA10"
                            className="w-full px-4 py-2 border rounded-lg uppercase font-bold text-gray-900 tracking-wider"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Valor do Desconto (%)</label>
                        <input 
                            type="number" 
                            value={formData.discountValue}
                            onChange={e => setFormData({...formData, discountValue: parseInt(e.target.value)})}
                            className="w-full px-4 py-2 border rounded-lg"
                        />
                    </div>
                </div>
            </div>

            {/* Step 2: Strategy */}
            <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Estratégia de Público
                </h3>
                <div className="space-y-3">
                    {strategies.map(s => (
                        <div 
                            key={s.id}
                            onClick={() => setFormData({...formData, strategy: s.id})}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                formData.strategy === s.id 
                                ? 'border-red-500 bg-red-50' 
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <div>
                                <h4 className="font-bold text-gray-900">{s.title}</h4>
                                <p className="text-sm text-gray-500">{s.desc}</p>
                            </div>
                            <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">
                                {s.potential}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 3: Budget */}
            <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Investimento
                </h3>
                <div className="bg-gray-50 p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <label className="font-medium text-gray-700">Orçamento Total</label>
                        <div className="flex items-center gap-1 font-bold text-xl text-gray-900">
                            R$ <input 
                                type="number" 
                                value={formData.totalBudget}
                                onChange={e => setFormData({...formData, totalBudget: parseInt(e.target.value)})}
                                className="w-20 bg-transparent text-right border-b border-gray-300 focus:border-red-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="font-medium text-gray-700">Duração (dias)</label>
                        <input 
                            type="number" 
                            value={formData.days}
                            onChange={e => setFormData({...formData, days: parseInt(e.target.value)})}
                            className="w-20 px-2 py-1 border rounded text-right"
                        />
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500 text-center">
                        Isso equivale a <strong>R$ {(formData.totalBudget / formData.days).toFixed(2)} por dia</strong>
                    </div>
                </div>
            </div>

        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">
                Cancelar
            </button>
            <button 
                onClick={handleSubmit}
                disabled={loading || !formData.couponCode}
                className="px-8 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Criando...' : '🚀 Lançar Campanha'}
            </button>
        </div>

      </div>
    </div>
  );
}