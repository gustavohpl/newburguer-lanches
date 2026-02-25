import React, { useState } from 'react';
import { X, ChevronRight, Check, Image as ImageIcon, Target, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useMetaAPI } from '../../../hooks/useMetaAPI';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, title: 'Básico', icon: Target },
  { id: 2, title: 'Público', icon: Check },
  { id: 3, title: 'Criativo', icon: ImageIcon },
  { id: 4, title: 'Orçamento', icon: DollarSign },
];

export function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { createCampaign } = useMetaAPI();

  const [formData, setFormData] = useState({
    name: '',
    objective: 'OUTCOME_SALES',
    product: '',
    
    // Audience
    ageMin: 18,
    ageMax: 65,
    gender: 'ALL',
    locationRadius: 5,
    interests: [] as string[],
    
    // Creative
    creativeType: 'IMAGE',
    imageFile: null as File | null,
    headline: '',
    primaryText: '',
    cta: 'ORDER_NOW',
    
    // Budget
    dailyBudget: 20,
    startDate: new Date().toISOString().split('T')[0],
  });

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Here we would upload image first if needed
      
      await createCampaign({
        name: formData.name,
        objective: formData.objective,
        daily_budget: formData.dailyBudget * 100, // cents
        targeting: {
          age_min: formData.ageMin,
          age_max: formData.ageMax,
          geo_locations: {
            custom_locations: [{
               latitude: -23.550520, // Example lat/long for Faroeste (should be dynamic)
               longitude: -46.633308,
               radius: formData.locationRadius,
               distance_unit: 'kilometer'
            }]
          },
        },
        creative: {
           headline: formData.headline,
           body: formData.primaryText,
           cta: formData.cta
        }
      });
      
      toast.success('Campanha criada com sucesso!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="border-b border-gray-100 p-6 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nova Campanha</h2>
            <p className="text-sm text-gray-500">Passo {step} de 4: {STEPS[step-1].title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-100">
          <div 
            className="h-full bg-red-600 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Campanha</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="Ex: Promoção X-Bacon Fim de Semana"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'OUTCOME_SALES', label: 'Vendas (Conversão)', desc: 'Maximizar pedidos no site' },
                    { id: 'OUTCOME_TRAFFIC', label: 'Tráfego', desc: 'Levar pessoas ao site' },
                    { id: 'OUTCOME_AWARENESS', label: 'Reconhecimento', desc: 'Mostrar para mais pessoas' }
                  ].map(obj => (
                    <div 
                      key={obj.id}
                      onClick={() => setFormData({...formData, objective: obj.id})}
                      className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                        formData.objective === obj.id 
                          ? 'border-red-500 bg-red-50' 
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <h4 className="font-bold text-gray-900">{obj.label}</h4>
                      <p className="text-xs text-gray-500 mt-1">{obj.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm mb-4">
                🎯 Vamos definir quem verá seus anúncios.
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Idade Mínima</label>
                   <input 
                    type="number" 
                    value={formData.ageMin}
                    onChange={e => setFormData({...formData, ageMin: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-lg"
                   />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Idade Máxima</label>
                   <input 
                    type="number" 
                    value={formData.ageMax}
                    onChange={e => setFormData({...formData, ageMax: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-lg"
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Raio de Localização (km)</label>
                <input 
                  type="range" 
                  min="1" 
                  max="50"
                  value={formData.locationRadius}
                  onChange={e => setFormData({...formData, locationRadius: parseInt(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="text-center text-sm font-bold text-gray-900 mt-2">
                  {formData.locationRadius} km ao redor do restaurante
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Texto Principal (Legenda)</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none h-32"
                  placeholder="Ex: O melhor hambúrguer da cidade chegou! Peça agora e ganhe entrega grátis."
                  value={formData.primaryText}
                  onChange={e => setFormData({...formData, primaryText: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título do Anúncio</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200"
                  placeholder="Ex: X-Bacon Artesanal 🥓"
                  value={formData.headline}
                  onChange={e => setFormData({...formData, headline: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chamada para Ação (CTA)</label>
                <select 
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white"
                  value={formData.cta}
                  onChange={e => setFormData({...formData, cta: e.target.value})}
                >
                  <option value="ORDER_NOW">Pedir Agora</option>
                  <option value="LEARN_MORE">Saiba Mais</option>
                  <option value="GET_OFFER">Obter Oferta</option>
                  <option value="SHOP_NOW">Comprar Agora</option>
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">Orçamento Diário</div>
                <div className="text-5xl font-bold text-gray-900 flex items-center justify-center gap-1">
                  <span className="text-2xl text-gray-400">R$</span>
                  <input 
                    type="number"
                    className="w-32 text-center bg-transparent border-none focus:ring-0 p-0"
                    value={formData.dailyBudget}
                    onChange={e => setFormData({...formData, dailyBudget: parseFloat(e.target.value)})}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-4">Estimativa: 1.2k - 3.5k impressões por dia</p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                <h4 className="font-bold text-yellow-800 mb-1">Resumo da Campanha</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Nome: {formData.name}</li>
                  <li>• Objetivo: {formData.objective}</li>
                  <li>• Raio: {formData.locationRadius}km</li>
                  <li>• Orçamento: R$ {formData.dailyBudget}/dia</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-2xl">
          <button 
            onClick={step === 1 ? onClose : handleBack}
            className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          <button 
            onClick={step === 4 ? handleSubmit : handleNext}
            disabled={loading}
            className="px-8 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : step === 4 ? 'Publicar Campanha' : 'Próximo'}
            {!loading && step < 4 && <ChevronRight size={18} />}
          </button>
        </div>

      </div>
    </div>
  );
}