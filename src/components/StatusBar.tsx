import React from 'react';
import { useConfig } from '../ConfigContext';

interface StatusBarProps {
  isStoreOpen?: boolean;
}

export function StatusBar({ isStoreOpen = true }: StatusBarProps) {
  const { config } = useConfig();
  const themeColor = config.themeColor || '#d97706';

  return (
    <div className="border-b border-white/5 py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center">
          {/* Status Central com animações */}
          <div className="flex flex-col items-center gap-3">
            {/* Status Aberto/Fechado */}
            {isStoreOpen ? (
              <div className="relative">
                {/* Badge de status - Sem blur externo exagerado */}
                <div className="relative px-8 py-3 bg-green-600 rounded-full shadow-lg">
                  <div className="flex items-center gap-3">
                    {/* Bolinha pulsante branca interna mais discreta */}
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    <span className="text-white font-bold text-base tracking-wide">
                      ABERTO AGORA
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Badge fechado */}
                <div className="relative px-8 py-3 bg-red-600 rounded-full shadow-lg">
                  <span className="text-white font-bold text-base tracking-wide">
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
                {config.openingHours || 'Todos os dias a partir das 18h30'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}