import React, { useState } from 'react';
import { Campaign } from '../../../hooks/useTrafegoPago';
import { useMetaAPI } from '../../../hooks/useMetaAPI';
import { toast } from 'sonner@2.0.3';

interface CampanhasListProps {
  campanhas: Campaign[];
  loading: boolean;
  onRefresh: () => void;
}

export function CampanhasList({ campanhas, loading, onRefresh }: CampanhasListProps) {
  const { pauseCampaign, resumeCampaign, updateBudget } = useMetaAPI();

  const handlePause = async (id: string) => {
    try {
      await pauseCampaign(id);
      toast.success('Campanha pausada!');
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleResume = async (id: string) => {
    try {
      await resumeCampaign(id);
      toast.success('Campanha ativada!');
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateBudget = async (id: string, budget: number) => {
    try {
      await updateBudget(id, budget);
      toast.success('Orçamento atualizado!');
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && campanhas.length === 0) {
    return <div className="p-8 text-center text-gray-500">Carregando campanhas...</div>;
  }

  if (campanhas.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
        <h3 className="text-lg font-medium text-gray-900">Nenhuma campanha encontrada</h3>
        <p className="text-gray-500 mt-1">Crie sua primeira campanha para começar a vender mais.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campanhas.map(c => (
        <CampaignCard 
          key={c.id}
          campaign={c}
          onPause={() => handlePause(c.id)}
          onResume={() => handleResume(c.id)}
          onUpdateBudget={(budget) => handleUpdateBudget(c.id, budget)}
        />
      ))}
    </div>
  );
}