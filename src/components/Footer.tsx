import React from 'react';
import { useConfig } from '../ConfigContext';
import logoImage from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';
import { Package, Truck } from 'lucide-react';
import { hexToRgba } from '../utils/colorUtils';

interface FooterProps {
  onTrackOrderClick: () => void;
}

export function Footer({ onTrackOrderClick }: FooterProps) {
  const { config } = useConfig();
  const themeColor = config.themeColor || '#d97706';
  const currentLogo = config.logoUrl || logoImage;
  const uiOpacity = (config.uiOpacity ?? 35) / 100; // Converter 0-100 para 0.0-1.0

  return (
    <footer className="text-white pt-24 pb-8 mt-0 relative overflow-hidden">
      {/* Degradê: transparente → escuro (inverso do header) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.85) 100%)'
      }} />
      <div className="container mx-auto px-4 relative z-10">
        {/* ============================================ */}
        {/* ORDEM ATUALIZADA: Taxa de Entrega PRIMEIRO */}
        {/* ============================================ */}
        
        {/* Taxa de Entrega - OPAQUE SOLID */}
        <div className="flex justify-center mb-6">
          <div 
            className="group relative px-8 py-3 rounded-xl overflow-hidden shadow-lg transition-all duration-300 flex items-center justify-center gap-3"
            style={{
              backgroundColor: themeColor,
              minWidth: '260px'
            }}
          >
            {/* Conteúdo */}
            <div className="relative z-10 flex items-center gap-2 text-white font-semibold">
              <Truck className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              <span className="text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Taxa de Entrega: <span className="text-yellow-300 font-extrabold ml-1 text-xl drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]">R$ {config.deliveryFee?.toFixed(2).replace('.', ',')}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* Botão de Acompanhar Pedido - ABAIXO da taxa */}
        {/* ============================================ */}
        {(config.features?.orderTracking !== false) && (
          <div className="flex justify-center mb-6">
              <button
                onClick={onTrackOrderClick}
                aria-label="Pedidos"
                className="px-8 py-3 rounded-lg font-bold shadow-md transition-all transform hover:scale-105 flex items-center justify-center gap-2 group"
                style={{ 
                  backgroundColor: themeColor,
                  minWidth: '260px'
                }}
              >
                <Package className="w-5 h-5 text-white group-hover:animate-bounce" />
                <span className="text-white text-base">Pedidos</span>
              </button>
          </div>
        )}

        {/* Logo no centro */}
        <div className="flex justify-center mb-4">
          <img 
            src={currentLogo} 
            alt={config.siteName || "Logo"} 
            className="h-20 w-auto object-contain drop-shadow-2xl"
          />
        </div>

        {/* Texto simples */}
        <div className="text-center">
          <p className="text-sm text-gray-400">{config.siteName} - Todos os direitos reservados</p>
        </div>
      </div>
    </footer>
  );
}
