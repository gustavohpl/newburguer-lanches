import React from 'react';
import { Phone, MapPin, Star, Heart, Sparkles, Zap, Snowflake, Flame, Music, Sun, Moon, Circle, Cloud } from 'lucide-react';
import { useConfig } from '../ConfigContext';
import logoImage from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';
import headerBg from 'figma:asset/6dbb44028ed8a316eb5f92fc5d24fd96935de5f0.png';
import { hexToRgba } from '../utils/colorUtils';

export function Header() {
  const { config } = useConfig();
  
  // Usar imagens do config ou fallback para o padrão
  const currentLogo = config.logoUrl || logoImage;
  const currentBg = config.headerBackgroundUrl || headerBg;
  const themeColor = config.themeColor || '#d97706';
  const effectShape = config.headerEffectShape || 'star';
  const effectCount = config.headerEffectCount ?? 3; // Padrão: 3 efeitos
  const randomPosition = config.headerEffectRandomPosition ?? false; // Padrão: posições fixas
  const randomSeed = config.headerEffectRandomSeed ?? 12345; // Seed para posições aleatórias
  const uiOpacity = (config.uiOpacity ?? 35) / 100; // Converter 0-100 para 0.0-1.0

  // Mapa de ícones para o efeito
  const EffectIcon = {
    star: Star,
    heart: Heart,
    sparkles: Sparkles,
    zap: Zap,
    snowflake: Snowflake,
    flame: Flame,
    music: Music,
    sun: Sun,
    moon: Moon,
    circle: Circle,
    cloud: Cloud
  }[effectShape] || Star; // Fallback para Star se não encontrar

  // Posições pré-definidas para efeitos (até 15)
  const predefinedPositions = [
    { top: '24px', left: '32px', size: 'w-8 h-8', opacity: 0.3, delay: '0s' },
    { top: '48px', right: '48px', size: 'w-6 h-6', opacity: 0.2, delay: '0.5s' },
    { bottom: '32px', left: '64px', size: 'w-5 h-5', opacity: 0.25, delay: '1s' },
    { top: '60px', left: '45%', size: 'w-7 h-7', opacity: 0.28, delay: '0.3s' },
    { bottom: '56px', right: '25%', size: 'w-6 h-6', opacity: 0.22, delay: '0.8s' },
    { top: '35%', right: '80px', size: 'w-8 h-8', opacity: 0.26, delay: '0.2s' },
    { bottom: '45%', left: '40px', size: 'w-5 h-5', opacity: 0.24, delay: '1.2s' },
    { top: '20%', left: '20%', size: 'w-6 h-6', opacity: 0.27, delay: '0.6s' },
    { top: '70%', right: '15%', size: 'w-7 h-7', opacity: 0.23, delay: '0.9s' },
    { bottom: '20%', left: '30%', size: 'w-5 h-5', opacity: 0.29, delay: '0.4s' },
    { top: '40%', left: '70%', size: 'w-6 h-6', opacity: 0.21, delay: '1.1s' },
    { bottom: '60%', right: '35%', size: 'w-8 h-8', opacity: 0.25, delay: '0.7s' },
    { top: '15%', right: '20%', size: 'w-5 h-5', opacity: 0.28, delay: '1.3s' },
    { bottom: '25%', left: '55%', size: 'w-7 h-7', opacity: 0.22, delay: '0.1s' },
    { top: '80%', left: '15%', size: 'w-6 h-6', opacity: '0.26', delay: '1.4s' },
  ];

  // Gerar posições aleatórias se necessário
  const generateRandomPosition = (index: number) => {
    const seed = (randomSeed + index) * 1234; // Usar a seed do config + índice
    const topBottom = seed % 2 === 0 ? 'top' : 'bottom';
    const leftRight = seed % 3 === 0 ? 'left' : 'right';
    const position = 10 + (seed % 70); // 10% a 80%
    const sizes = ['w-5 h-5', 'w-6 h-6', 'w-7 h-7', 'w-8 h-8'];
    const size = sizes[seed % sizes.length];
    const opacity = 0.2 + (seed % 10) / 100; // 0.2 a 0.29
    const delay = `${(seed % 15) / 10}s`; // 0s a 1.4s
    
    return {
      [topBottom]: `${position}%`,
      [leftRight]: `${position}%`,
      size,
      opacity,
      delay,
    };
  };

  // Criar array de efeitos
  const effects = Array.from({ length: Math.min(Math.max(effectCount, 0), 15) }, (_, i) => {
    if (randomPosition) {
      return generateRandomPosition(i);
    }
    return predefinedPositions[i] || predefinedPositions[0];
  });

  return (
    <header className="relative overflow-hidden shadow-2xl">
      {/* Imagem de fundo com filtro escuro */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${currentBg})`,
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
        }}
      />
      
      {/* Overlay escuro 50% + gradiente - SEM BLUR */}
      <div className="absolute inset-0 bg-black/60" />
      <div 
        className="absolute inset-0" 
        style={{ 
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)'
        }} 
      />

      {/* Elementos decorativos Western */}
      {/* Efeitos animados (Pulsar) - Dinâmicos */}
      {effects.map((effect, index) => (
        <div
          key={index}
          className={`absolute animate-pulse ${effect.size}`}
          style={{
            color: themeColor,
            opacity: effect.opacity,
            animationDelay: effect.delay,
            ...Object.fromEntries(
              Object.entries(effect).filter(([key]) => ['top', 'bottom', 'left', 'right'].includes(key))
            ),
          }}
        >
          <EffectIcon className="w-full h-full fill-current" />
        </div>
      ))}

      {/* Chapéu de Cowboy decorativo (SVG) */}
      <div className="absolute top-8 right-8 opacity-10" style={{ color: themeColor }}>
        <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C11 2 10 3 9 5C8 4 7 4 6 5C5 6 4 8 4 10C3 11 2 12 2 14C2 16 3 17 5 18C7 19 9 19 12 19C15 19 17 19 19 18C21 17 22 16 22 14C22 12 21 11 20 10C20 8 19 6 18 5C17 4 16 4 15 5C14 3 13 2 12 2M12 4C12.5 4 13 5 13.5 6.5C13 7 12.5 7.5 12 7.5C11.5 7.5 11 7 10.5 6.5C11 5 11.5 4 12 4M7 6.5C7.5 6.5 8 7 8.5 8C7.5 8.5 7 9.5 6.5 10.5C6 10 5.5 9 5.5 8C5.5 7 6 6.5 7 6.5M17 6.5C18 6.5 18.5 7 18.5 8C18.5 9 18 10 17.5 10.5C17 9.5 16.5 8.5 15.5 8C16 7 16.5 6.5 17 6.5Z"/>
        </svg>
      </div>

      {/* Ferradura decorativa (SVG) - esquerda */}
      <div className="absolute bottom-6 right-6 opacity-10 transform rotate-12" style={{ color: themeColor }}>
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 9C4 7.67392 4.52678 6.40215 5.46447 5.46447C6.40215 4.52678 7.67392 4 9 4H15C16.3261 4 17.5979 4.52678 18.5355 5.46447C19.4732 6.40215 20 7.67392 20 9V16C20 16.5304 19.7893 17.0391 19.4142 17.4142C19.0391 17.7893 18.5304 18 18 18C17.4696 18 16.9609 17.7893 16.5858 17.4142C16.2107 17.0391 16 16.5304 16 16V9C16 8.73478 15.8946 8.48043 15.7071 8.29289C15.5196 8.10536 15.2652 8 15 8H9C8.73478 8 8.48043 8.10536 8.29289 8.29289C8.10536 8.48043 8 8.73478 8 9V16C8 16.5304 7.78929 17.0391 7.41421 17.4142C7.03914 17.7893 6.53043 18 6 18C5.46957 18 4.96086 17.7893 4.58579 17.4142C4.21071 17.0391 4 16.5304 4 16V9Z"/>
        </svg>
      </div>

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-10 relative z-10">
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* Logo com glow effect */}
            <div className="relative">
              {/* Glow dourado atrás do logo */}
              <div className="absolute inset-0 blur-2xl scale-110 animate-pulse" style={{ backgroundColor: themeColor, opacity: 0.3 }} />
              
              <img 
                src={currentLogo} 
                alt={config.siteName || "Logo"} 
                className="h-72 w-auto object-contain drop-shadow-[0_0_25px_rgba(251,191,36,0.5)] relative z-10"
              />
            </div>

            {/* Linha decorativa com estrelas */}
            <div className="flex items-center gap-3 my-4">
              <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${themeColor})` }} />
              <Star className="w-4 h-4" style={{ fill: themeColor, color: themeColor }} />
              <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${themeColor})` }} />
            </div>
            
            {/* Caixas de informação - fundo transparente, ícones em círculo sólido */}
            <div className="flex flex-col items-center gap-3">
              {/* Telefone */}
              <div className="inline-flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{ backgroundColor: themeColor }}
                >
                  <Phone className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-base font-extrabold text-white tracking-wide" style={{ textShadow: '0 0 6px rgba(255,255,255,0.35), 0 0 12px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.9)' }}>
                  {config.phone || '(64) 99339-2970'}
                </span>
              </div>

              {/* Endereço */}
              <div className="inline-flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 self-start mt-0.5 shadow-lg"
                  style={{ backgroundColor: themeColor }}
                >
                  <MapPin className="w-4.5 h-4.5 text-white" />
                </div>
                
                <div className="flex flex-col items-center">
                  {(config.address || 'Praça Lucio Prado - Goiatuba/GO').split(/,| - |\\n/).filter((line: string) => line.trim()).map((line: string, i: number) => (
                    <span key={i} className="text-sm font-extrabold text-white tracking-wide leading-snug" style={{ textShadow: '0 0 6px rgba(255,255,255,0.35), 0 0 12px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.9)' }}>
                      {line.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Border inferior sutil removida a pedido */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
    </header>
  );
}