import React from 'react';
import { useConfig } from '../ConfigContext';
import { useFranchise } from '../FranchiseContext';
import { useDesign } from '../useDesign';

interface StatusBarProps {
  isStoreOpen?: boolean;
}

export function StatusBar({ isStoreOpen = true }: StatusBarProps) {
  const { config } = useConfig();
  const { unitOverrides } = useFranchise();
  const design = useDesign();
  const isClean = design.statusStyle === 'dot';
  const themeColor = config.themeColor || '#d97706';
  const effectiveHours = unitOverrides.openingHours || config.openingHours || 'Todos os dias a partir das 18h30';

  return (
    <div className={`py-4 ${isClean ? 'border-b border-zinc-200 bg-zinc-50' : 'border-b border-white/5'}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center">
          {/* Status Central com animações */}
          <div className="flex flex-col items-center gap-3">
            {isClean ? (
              /* ===== DESIGN CLEAN: dot minimalista + horário leve ===== */
              <>
                <div className="flex items-center gap-2">
                  <span className={`relative flex h-2.5 w-2.5`}>
                    {isStoreOpen && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#16a34a' }} />
                    )}
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: isStoreOpen ? '#16a34a' : '#dc2626' }} />
                  </span>
                  <span className={`font-semibold text-sm tracking-wide ${isStoreOpen ? 'text-green-700' : 'text-red-600'}`}>
                    {isStoreOpen ? 'Aberto agora' : 'Fechado'}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-zinc-200 shadow-sm">
                  <span className="text-base" style={{ color: themeColor }}>🕐</span>
                  <span className="text-sm font-medium text-zinc-700 whitespace-pre-line text-center">
                    {effectiveHours}
                  </span>
                </div>
              </>
            ) : (
              /* ===== DESIGN CLÁSSICO: badge original (inalterado) ===== */
              <>
            {/* Status Aberto/Fechado */}
            {isStoreOpen ? (
              <div className="relative">
                <div className="relative px-4 py-1.5 bg-green-600 rounded-full shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <span className="text-white font-bold text-xs tracking-wide">
                      ABERTO AGORA
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative px-4 py-1.5 bg-red-600 rounded-full shadow-md">
                  <span className="text-white font-bold text-xs tracking-wide">
                    FECHADO
                  </span>
                </div>
              </div>
            )}

            {/* Horário de funcionamento */}
            <div 
              className="group relative px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2 overflow-hidden"
              style={{ background: `linear-gradient(to right, ${themeColor}, ${themeColor}dd)` }}
            >
              {/* Shine effect interno */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              
              <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                <span className="text-lg text-white">🕐</span>
              </div>
              <span className="text-sm font-bold text-white drop-shadow-md relative z-10 whitespace-pre-line text-center">
                {effectiveHours}
              </span>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}