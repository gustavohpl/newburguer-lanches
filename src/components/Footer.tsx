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
    <footer className="bg-black text-white py-8 mt-16 shadow-lg relative overflow-hidden">
      {/* Degradê sutil saindo do centro */}
      <div className="absolute inset-0" 
           style={{ 
             background: `radial-gradient(circle at center, ${themeColor}4D 0%, rgba(0, 0, 0, 0) 60%)` // 4D is approx 30% opacity
           }} 
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* ============================================ */}
        {/* ORDEM ATUALIZADA: Taxa de Entrega PRIMEIRO */}
        {/* ============================================ */}
        
        {/* Taxa de Entrega - MATCHING BUTTON SIZE */}
        <div className="flex justify-center mb-6">
          <div 
            className="group relative px-8 py-3 rounded-xl overflow-hidden shadow-lg transition-all duration-300 flex items-center justify-center gap-3 border border-white/20"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(themeColor, uiOpacity * 0.5)} 0%, ${hexToRgba(themeColor, uiOpacity * 0.3)} 100%)`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              minWidth: '260px'
            }}
          >
            {/* Glass inner highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
            {/* Conteúdo */}
            <div className="relative z-10 flex items-center gap-2 text-white font-semibold">
              <Truck className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              <span className="text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Taxa de Entrega: <span className="text-green-300 font-bold ml-1 text-lg">R$ {config.deliveryFee?.toFixed(2).replace('.', ',')}</span>
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
                aria-label="Meus Pedidos"
                className="px-8 py-3 rounded-lg font-bold shadow-md transition-all transform hover:scale-105 flex items-center justify-center gap-2 group"
                style={{ 
                  backgroundColor: themeColor,
                  minWidth: '260px'
                }}
              >
                <Package className="w-5 h-5 text-white group-hover:animate-bounce" />
                <span className="text-white text-base">Meus Pedidos</span>
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
