import React, { useState, useEffect } from 'react';
import { Store, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import * as api from '../../utils/api';

interface StoreStatusControlProps {
  onStatusChange?: (isOpen: boolean) => void;
}

export function StoreStatusControl({ onStatusChange }: StoreStatusControlProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Carregar status inicial
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await api.getStoreStatus();
      if (response.success) {
        const storeStatus = response.isOpen !== undefined ? response.isOpen : true;
        setIsOpen(storeStatus);
        setIsOffline(!!response.offline);
        if (onStatusChange) {
          onStatusChange(storeStatus);
        }
      }
    } catch (error) {
      // Erro silencioso - usar modo offline
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async () => {
    try {
      const newStatus = !isOpen;
      const response = await api.setStoreStatus(newStatus);
      if (response.success) {
        setIsOpen(newStatus);
        setIsOffline(!!response.offline);
        if (onStatusChange) {
          onStatusChange(newStatus);
        }
      }
    } catch (error) {
      // Erro silencioso - usar modo offline
      setIsOffline(true);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-100 rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-300 rounded w-48 mb-2"></div>
        <div className="h-12 bg-gray-300 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow-md p-6 border-l-4 ${
      isOpen ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full ${isOpen ? 'bg-green-100' : 'bg-red-100'}`}>
            <Store className={`w-6 h-6 ${isOpen ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-800">Status da Loja</h3>
            <p className="text-sm text-gray-600">
              Controle se o site está aberto ou fechado para clientes
            </p>
          </div>
        </div>
        
        <button
          onClick={toggleStatus}
          className={`px-6 py-3 rounded-lg font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 ${
            isOpen 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isOpen && (
            <>
              <XCircle className="w-5 h-5" />
              <span>Fechar Loja</span>
            </>
          )}
          {!isOpen && (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Abrir Loja</span>
            </>
          )}
        </button>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className={`font-semibold ${isOpen ? 'text-green-700' : 'text-red-700'}`}>
            {isOpen ? '🟢 Site ABERTO - Clientes podem fazer pedidos' : '🔴 Site FECHADO - Clientes não podem fazer pedidos'}
          </span>
        </div>
        {isOffline && (
          <div className="mt-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-500">Sem conexão com a internet</span>
          </div>
        )}
      </div>
    </div>
  );
}