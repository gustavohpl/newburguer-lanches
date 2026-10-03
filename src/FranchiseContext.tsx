import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useConfig, FranchiseCity, FranchiseUnit } from './ConfigContext';
import { setActiveUnitId } from './utils/api';

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
  localizando: boolean;
  
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
  localizando: false,
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

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
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
  const { config, refreshConfig } = useConfig();
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

  // na renderização (não em efeito): os efeitos dos filhos rodam antes e já buscariam dados sem a unidade
  setActiveUnitId(franchiseEnabled && selectedUnit ? selectedUnitId : null);
  // categorias, textos e pixel da unidade vêm junto da config pública
  const unidadeAtiva = franchiseEnabled && selectedUnit ? selectedUnitId : null;
  useEffect(() => { if (unidadeAtiva) refreshConfig(); }, [unidadeAtiva]);

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

  // celular escolhe a cidade cadastrada mais perto (até 60 km); sem permissão ou longe, fica a escolha manual
  const [localizando, setLocalizando] = useState(false);
  useEffect(() => {
    if (!franchiseEnabled || !initialized || selectedCityId || (pageType !== 'client' && pageType !== 'delivery')) return;
    const comCoord = cities.filter((c: any) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (!comCoord.length || !navigator.geolocation) return;
    try { if (sessionStorage.getItem('franquia_gps_tentado')) return; sessionStorage.setItem('franquia_gps_tentado', '1'); } catch { /* sem storage: tenta mesmo assim */ }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const perto = comCoord.map((c: any) => ({ c, km: distanciaKm(coords.latitude, coords.longitude, c.lat, c.lng) })).sort((a, b) => a.km - b.km)[0];
      if (perto.km <= 60) {
        selectCity(perto.c.id);
        if (perto.c.units.length === 1) selectUnit(perto.c.units[0].id);
      }
      setLocalizando(false);
    }, () => setLocalizando(false), { timeout: 8000, maximumAge: 600000 });
  }, [franchiseEnabled, initialized, selectedCityId, cities.length]);

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
      localizando,
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
