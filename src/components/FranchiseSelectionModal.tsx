import React, { useState } from 'react';
import { Building2, MapPin, ChevronRight, ArrowLeft } from 'lucide-react';
import { useFranchise } from '../FranchiseContext';
import { useConfig } from '../ConfigContext';

// ============================================
// 🏙️ MODAL DE SELEÇÃO DE CIDADE/UNIDADE
// Aparece quando franchise está ativo e não há seleção
// Step 1: Escolher cidade
// Step 2: Escolher unidade (mostra endereço)
// ============================================

export function FranchiseSelectionModal() {
  const { config } = useConfig();
  const { 
    needsSelection, 
    cities, 
    selectedCity,
    unitsForSelectedCity,
    selectCity, 
    selectUnit,
    resetSelection,
    pageType
  } = useFranchise();

  const [step, setStep] = useState<'city' | 'unit'>('city');
  const themeColor = config.themeColor || '#d97706';

  // Não mostrar se não precisa
  if (!needsSelection) return null;

  // Se já tem cidade selecionada mas falta unidade, ir direto pro step 2
  const currentStep = selectedCity ? 'unit' : step;

  const handleCityClick = (cityId: string) => {
    selectCity(cityId);
    setStep('unit');
  };

  const handleUnitClick = (unitId: string) => {
    selectUnit(unitId);
    // Modal fecha automaticamente (needsSelection vira false)
  };

  const handleBackToCity = () => {
    resetSelection();
    setStep('city');
  };

  // Texto do header baseado no tipo de página
  const pageLabel = pageType === 'admin' 
    ? 'Painel Admin' 
    : pageType === 'delivery' 
      ? 'Painel do Entregador' 
      : '';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 pb-4 text-center" style={{ backgroundColor: themeColor }}>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {config.siteName || 'NewBurguer'}
          </h2>
          {pageLabel && (
            <p className="text-white/70 text-xs mt-1">{pageLabel}</p>
          )}
          <p className="text-white/80 text-sm mt-2">
            {currentStep === 'city' 
              ? 'Selecione sua cidade' 
              : 'Escolha a unidade'}
          </p>
        </div>

        {/* Content */}
        <div className="p-5">
          
          {/* Step 1: Cidades */}
          {currentStep === 'city' && (
            <div className="space-y-2.5">
              {cities.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">Nenhuma cidade disponível</p>
                  <p className="text-gray-300 text-xs mt-1">Peça ao administrador para configurar as cidades</p>
                </div>
              ) : (
                cities.map(city => {
                  const openUnits = city.units.filter(u => u.isOpen !== false).length;
                  const totalUnits = city.units.length;
                  return (
                    <button
                      key={city.id}
                      onClick={() => handleCityClick(city.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-current transition-all hover:shadow-md text-left group"
                      style={{ '--tw-border-opacity': 1 } as any}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = themeColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f3f4f6')}
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: themeColor }}>
                        {city.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-base">{city.name}</p>
                        <p className="text-xs text-gray-400">
                          {totalUnits} unidade{totalUnits !== 1 ? 's' : ''} 
                          {openUnits < totalUnits && ` • ${openUnits} aberta${openUnits !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Step 2: Unidades */}
          {currentStep === 'unit' && selectedCity && (
            <div>
              {/* Botão voltar */}
              {cities.length > 1 && (
                <button
                  onClick={handleBackToCity}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Trocar cidade
                </button>
              )}

              <p className="text-xs text-gray-400 mb-3 font-medium">
                📍 {selectedCity.name} — Escolha a unidade:
              </p>

              <div className="space-y-2.5">
                {unitsForSelectedCity.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-400 text-sm">Nenhuma unidade nesta cidade</p>
                  </div>
                ) : (
                  unitsForSelectedCity.map(unit => (
                    <button
                      key={unit.id}
                      onClick={() => handleUnitClick(unit.id)}
                      disabled={unit.isOpen === false}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group ${
                        unit.isOpen === false 
                          ? 'border-gray-100 opacity-50 cursor-not-allowed' 
                          : 'border-gray-100 hover:shadow-md'
                      }`}
                      onMouseEnter={(e) => { if (unit.isOpen !== false) e.currentTarget.style.borderColor = themeColor; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f3f4f6'; }}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${unit.isOpen === false ? 'bg-gray-300' : ''}`} style={unit.isOpen !== false ? { backgroundColor: themeColor } : {}}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800 text-sm">{unit.name}</p>
                          {unit.isOpen === false && (
                            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">FECHADA</span>
                          )}
                        </div>
                        {unit.address && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{unit.address}</span>
                          </p>
                        )}
                        {unit.openingHours && (
                          <p className="text-xs text-gray-300 mt-0.5">🕐 {unit.openingHours}</p>
                        )}
                      </div>
                      {unit.isOpen !== false && (
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-1">
          <p className="text-center text-[10px] text-gray-300">
            {config.siteName || 'NewBurguer'} • Sistema de Franquias
          </p>
        </div>
      </div>
    </div>
  );
}
