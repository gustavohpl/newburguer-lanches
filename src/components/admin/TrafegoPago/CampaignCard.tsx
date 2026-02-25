
import React, { useState } from 'react';
import { Pause, Play, BarChart2, Edit2, TrendingUp, DollarSign } from 'lucide-react';
import { Campaign } from '../../../hooks/useTrafegoPago';

interface CampaignCardProps {
  campaign: Campaign;
  onPause: () => void;
  onResume: () => void;
  onUpdateBudget: (budget: number) => void;
}

export function CampaignCard({ campaign, onPause, onResume, onUpdateBudget }: CampaignCardProps) {
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(campaign.daily_budget / 100);

  const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBudget(newBudget * 100);
    setIsEditingBudget(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-gray-900">{campaign.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              campaign.status === 'ACTIVE' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {campaign.status === 'ACTIVE' ? 'ATIVA' : 'PAUSADA'}
            </span>
          </div>
          <p className="text-sm text-gray-500">ID: {campaign.id}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Ver Detalhes">
            <BarChart2 size={18} />
          </button>
          {campaign.status === 'ACTIVE' ? (
            <button 
              onClick={onPause}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-1 text-sm font-medium"
            >
              <Pause size={16} /> Pausar
            </button>
          ) : (
             <button 
              onClick={onResume}
              className="p-2 hover:bg-green-50 text-green-600 rounded-lg flex items-center gap-1 text-sm font-medium"
            >
              <Play size={16} /> Ativar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-gray-50">
        <div>
          <p className="text-xs text-gray-500 mb-1">Orçamento Diário</p>
          {isEditingBudget ? (
            <form onSubmit={handleBudgetSubmit} className="flex items-center gap-1">
              <span className="text-sm">R$</span>
              <input 
                type="number" 
                value={newBudget}
                onChange={(e) => setNewBudget(parseFloat(e.target.value))}
                className="w-20 px-2 py-1 text-sm border rounded"
                autoFocus
                onBlur={() => setIsEditingBudget(false)}
              />
            </form>
          ) : (
            <div 
              className="font-semibold text-gray-900 flex items-center gap-1 cursor-pointer hover:text-red-600"
              onClick={() => setIsEditingBudget(true)}
              title="Clique para editar"
            >
              R$ {(campaign.daily_budget / 100).toFixed(2)} 
              <Edit2 size={12} className="opacity-50" />
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Gasto Total</p>
          <p className="font-semibold text-gray-900">R$ {campaign.spend.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Vendas / Custo por Venda</p>
          <p className="font-semibold text-gray-900">
            {campaign.purchases} <span className="text-gray-400 text-xs">({campaign.purchases > 0 ? `R$ ${(campaign.spend / campaign.purchases).toFixed(2)}` : '-'})</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">ROAS</p>
          <div className="flex items-center gap-1">
             <p className={`font-bold ${roas >= 4 ? 'text-green-600' : roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
              {roas.toFixed(1)}x
            </p>
            {roas >= 5 && <TrendingUp size={14} className="text-green-600" />}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <div className="flex gap-4">
            <span>👁️ {campaign.impressions} imp.</span>
            <span>👆 {campaign.clicks} cliques ({(campaign.clicks / (campaign.impressions || 1) * 100).toFixed(1)}%)</span>
        </div>
        <span className="font-medium text-green-700">
            Receita: R$ {campaign.revenue.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
