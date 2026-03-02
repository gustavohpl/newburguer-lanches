import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useConfig, FranchiseCity, FranchiseUnit } from './ConfigContext';
import { setActiveUnitId } from './utils/api';
import { setActiveUnitId as setApiUnitId } from './utils/api';

// ============================================
// 🏙️ FRANCHISE CONTEXT
// Gerencia seleção de cidade/unidade
// - Client/Entregador: sessionStorage (reload mantém, fechar perde)
// - Admin: localStorage (persiste sempre)
// - Quando franchise desativado: tudo null, modal nunca aparece
// ============================================

interface FranchiseContextType {
  // Estado
  franchiseEnabled: boolean;
  selectedCity: FranchiseCity | null;
  selectedUnit: FranchiseUnit | null;
  needsSelection: boolean; // true = modal deve aparecer
  
  // Ações
  selectCity: (cityId: string) => void;
  selectUnit: (unitId: string) => void;
  resetSelection: () => void;
  
  // Helpers
  cities: FranchiseCity[];
  unitsForSelectedCity: FranchiseUnit[];
  pageType: 'client' | 'admin' | 'delivery' | 'master';
  
  // Valores efetivos da unidade (override do config global)
  // Quando franchise desativado → tudo undefined (usa config normal)
  unitOverrides: {
    phone?: string;
    address?: string;
    googleMapsUrl?: string;
    openingHours?: string;
    deliveryFee?: number;
    isOpen?: boolean;
  };
}

const FranchiseContext = createContext<FranchiseContextType>({
  franchiseEnabled: false,
  selectedCity: null,
  selectedUnit: null,
  needsSelection: false,
  selectCity: () => {},
  selectUnit: () => {},
  resetSelection: () => {},
  cities: [],
  unitsForSelectedCity: [],
  pageType: 'client',
  unitOverrides: {},
});

export const useFranchise = () => useContext(FranchiseContext);

// Detectar tipo de página
function getPageType(): 'client' | 'admin' | 'delivery' | 'master' {
  const path = window.location.pathname;
  if (path === '/master') return 'master';
  if (path === '/admin') return 'admin';
  if (path === '/entrega') return 'delivery';
  return 'client';
}

// Storage keys
const STORAGE_KEY_CITY = 'franchise_selected_city';
const STORAGE_KEY_UNIT = 'franchise_selected_unit';

// Ler do storage correto
function readStorage(pageType: string, key: string): string | null {
  try {
    if (pageType === 'admin') {
      return localStorage.getItem(key);
    }
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

// Escrever no storage correto
function writeStorage(pageType: string, key: string, value: string) {
  try {
    if (pageType === 'admin') {
      localStorage.setItem(key, value);
    }
    sessionStorage.setItem(key, value);
  } catch {
    // Storage indisponível
  }
}

// Limpar storage
function clearStorage(pageType: string) {
  try {
    if (pageType === 'admin') {
      localStorage.removeItem(STORAGE_KEY_CITY);
      localStorage.removeItem(STORAGE_KEY_UNIT);
    }
    sessionStorage.removeItem(STORAGE_KEY_CITY);
    sessionStorage.removeItem(STORAGE_KEY_UNIT);
  } catch {
    // Storage indisponível
  }
}

export function FranchiseProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const [pageType] = useState<'client' | 'admin' | 'delivery' | 'master'>(getPageType);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const franchiseEnabled = !!(config.franchise?.enabled);
  const cities = config.franchise?.cities || [];

  // Restaurar seleção do storage na inicialização
  useEffect(() => {
    if (!franchiseEnabled || pageType === 'master') {
      setInitialized(true);
      return;
    }

    const savedCity = readStorage(pageType, STORAGE_KEY_CITY);
    const savedUnit = readStorage(pageType, STORAGE_KEY_UNIT);

    if (savedCity) {
      // Verificar se a cidade ainda existe
      const cityExists = cities.some(c => c.id === savedCity);
      if (cityExists) {
        setSelectedCityId(savedCity);
        if (savedUnit) {
          const city = cities.find(c => c.id === savedCity);
          const unitExists = city?.units.some(u => u.id === savedUnit);
          if (unitExists) {
            setSelectedUnitId(savedUnit);
          }
        }
      }
    }
    
    setInitialized(true);
  }, [franchiseEnabled, pageType]); // Não incluir cities para evitar loops

  // Derivar objetos completos
  const selectedCity = cities.find(c => c.id === selectedCityId) || null;
  const selectedUnit = selectedCity?.units.find(u => u.id === selectedUnitId) || null;
  const unitsForSelectedCity = selectedCity?.units || [];

  // 🔑 Sincronizar unitId com a camada de API
  // Isso faz com que TODAS as chamadas fetch incluam X-Unit-Id automaticamente
  useEffect(() => {
    if (franchiseEnabled && selectedUnitId) {
      setActiveUnitId(selectedUnitId);
      console.log(`🏙️ [FRANCHISE] API scope: unit:${selectedUnitId}`);
    } else {
      setActiveUnitId(null);
    }
  }, [franchiseEnabled, selectedUnitId]);

  // 🏙️ Sincronizar unitId com o módulo de API
  useEffect(() => {
    setApiUnitId(selectedUnitId);
  }, [selectedUnitId]);

  // Precisa mostrar modal?
  const needsSelection = franchiseEnabled 
    && initialized 
    && pageType !== 'master' 
    && (!selectedCity || !selectedUnit);

  // Selecionar cidade
  const selectCity = useCallback((cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedUnitId(null); // Resetar unidade ao trocar cidade
    writeStorage(pageType, STORAGE_KEY_CITY, cityId);
    // Limpar unidade do storage
    try {
      if (pageType === 'admin') localStorage.removeItem(STORAGE_KEY_UNIT);
      sessionStorage.removeItem(STORAGE_KEY_UNIT);
    } catch {}
  }, [pageType]);

  // Selecionar unidade
  const selectUnit = useCallback((unitId: string) => {
    setSelectedUnitId(unitId);
    writeStorage(pageType, STORAGE_KEY_UNIT, unitId);
  }, [pageType]);

  // Resetar seleção (para trocar de franquia)
  const resetSelection = useCallback(() => {
    setSelectedCityId(null);
    setSelectedUnitId(null);
    clearStorage(pageType);
  }, [pageType]);

  // Valores efetivos: quando tem unidade selecionada, usa os dados dela
  const unitOverrides = franchiseEnabled && selectedUnit ? {
    phone: selectedUnit.phone || undefined,
    address: selectedUnit.address || undefined,
    googleMapsUrl: selectedUnit.googleMapsUrl || undefined,
    openingHours: selectedUnit.openingHours || undefined,
    deliveryFee: selectedUnit.deliveryFee,
    isOpen: selectedUnit.isOpen,
  } : {};

  return (
    <FranchiseContext.Provider value={{
      franchiseEnabled,
      selectedCity,
      selectedUnit,
      needsSelection,
      selectCity,
      selectUnit,
      resetSelection,
      cities,
      unitsForSelectedCity,
      pageType,
      unitOverrides,
    }}>
      {children}
    </FranchiseContext.Provider>
  );
}
