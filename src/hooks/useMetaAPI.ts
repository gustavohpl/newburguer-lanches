import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2/meta`;

export function useMetaAPI() {
  
  const getHeaders = () => {
    // Check for admin token if available (implementation detail from App.tsx)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // If we had a token tracking system here, we'd add it
    return headers;
  };

  const syncCampaigns = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/sync`, {
        method: 'POST',
        headers: getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('Meta Sync Error:', error);
      throw error;
    }
  };

  const createCampaign = async (data: any) => {
    try {
      const response = await fetch(`${SERVER_URL}/campaigns`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
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
      const response = await fetch(`${SERVER_URL}/campaigns/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'PAUSED' })
      });
      return await response.json();
    } catch (error) {
      toast.error('Erro ao pausar campanha');
      throw error;
    }
  };
  
  const resumeCampaign = async (id: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/campaigns/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      return await response.json();
    } catch (error) {
      toast.error('Erro ao ativar campanha');
      throw error;
    }
  };

  const updateBudget = async (id: string, budget: number) => {
    try {
      const response = await fetch(`${SERVER_URL}/campaigns/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ daily_budget: budget })
      });
      return await response.json();
    } catch (error) {
      toast.error('Erro ao atualizar orçamento');
      throw error;
    }
  };
  
  const createAudience = async (data: any) => {
    try {
        const response = await fetch(`${SERVER_URL}/audiences`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
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