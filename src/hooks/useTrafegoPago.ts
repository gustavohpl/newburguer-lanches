
import { useState, useEffect } from 'react';
import { useMetaAPI } from './useMetaAPI';

export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: string;
  daily_budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  createdAt?: string;
}

export interface Metric {
  date: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  purchases: number;
}

export function useTrafegoPago() {
  const [campanhas, setCampanhas] = useState<Campaign[]>([]);
  const [metricas, setMetricas] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(false);
  const { syncCampaigns } = useMetaAPI();

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await syncCampaigns();
      if (data.success) {
        setCampanhas(data.campaigns || []);
        setMetricas(data.metrics || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de tráfego:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    carregarDados();
  }, []);

  const calcularROAS = (receita: number, gasto: number) => {
    if (!gasto || gasto === 0) return 0;
    return receita / gasto;
  };

  return { campanhas, metricas, loading, carregarDados, calcularROAS, setCampanhas };
}
