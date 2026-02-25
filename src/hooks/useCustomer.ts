import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2`;

export interface SavedAddress {
  id: string;
  street: string;
  reference?: string;
  createdAt: string;
}

export interface CustomerData {
  phone: string;
  name: string;
  addresses: SavedAddress[];
  lastOrderDate?: string;
  totalOrders: number;
}

export function useCustomer() {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);

  // Tentar carregar do localStorage ao iniciar
  useEffect(() => {
    const savedPhone = localStorage.getItem('faroeste_customer_phone');
    if (savedPhone) {
      fetchCustomer(savedPhone);
    }
  }, []);

  const fetchCustomer = async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return;

    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/customers/${cleanPhone}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        }
      });
      const data = await response.json();
      
      if (data.success && data.customer) {
        setCustomer(data.customer);
        // Atualizar localStorage para manter sessão
        localStorage.setItem('faroeste_customer_phone', cleanPhone);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('faroeste_customer_phone');
    setCustomer(null);
  };

  return {
    customer,
    loading,
    fetchCustomer,
    logout,
    isAuthenticated: !!customer
  };
}