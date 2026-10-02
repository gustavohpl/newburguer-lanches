import { toast } from 'sonner@2.0.3';
import { authFetch } from '../utils/api';

export function useMetaAPI() {
  // rotas /meta exigem o Admin logado (token + CSRF via authFetch)
  const chamar = (rota: string, method: string, body?: unknown) =>
    authFetch(`/meta${rota}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined && { body: JSON.stringify(body) }) });

  const syncCampaigns = async () => {
    try {
      const response = await chamar(`/sync`, 'POST');
      return await response.json();
    } catch (error) {
      console.error('Meta Sync Error:', error);
      throw error;
    }
  };

  const createCampaign = async (data: any) => {
    try {
      const response = await chamar(`/campaigns`, 'POST', data);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    } catch (error) {
      toast.error('Erro ao criar campanha');
      throw error;
    }
  };

  const pauseCampaign = async (id: string) => {
    try {
      const response = await chamar(`/campaigns/${id}`, 'PUT', { status: 'PAUSED' });
      return await response.json();
    } catch (error) {
      toast.error('Erro ao pausar campanha');
      throw error;
    }
  };
  
  const resumeCampaign = async (id: string) => {
    try {
      const response = await chamar(`/campaigns/${id}`, 'PUT', { status: 'ACTIVE' });
      return await response.json();
    } catch (error) {
      toast.error('Erro ao ativar campanha');
      throw error;
    }
  };

  const updateBudget = async (id: string, budget: number) => {
    try {
      const response = await chamar(`/campaigns/${id}`, 'PUT', { daily_budget: budget });
      return await response.json();
    } catch (error) {
      toast.error('Erro ao atualizar orçamento');
      throw error;
    }
  };
  
  const createAudience = async (data: any) => {
    try {
        const response = await chamar(`/audiences`, 'POST', data);
        return await response.json();
    } catch (error) {
        toast.error('Erro ao criar público');
        throw error;
    }
  };

  return { 
    syncCampaigns, 
    createCampaign, 
    pauseCampaign, 
    resumeCampaign,
    updateBudget,
    createAudience
  };
}