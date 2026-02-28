import React from 'react';
import { Phone, MapPin, Star, Heart, Sparkles, Zap, Snowflake, Flame, Music, Sun, Moon, Circle, Cloud } from 'lucide-react';
import { useConfig } from '../ConfigContext';
import logoImage from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';
import headerBg from 'figma:asset/6dbb44028ed8a316eb5f92fc5d24fd96935de5f0.png';
import { hexToRgba } from '../utils/colorUtils';

const SocialIcons: Record<string, React.FC<{className?: string}>> = {
  instagram: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  ),
  facebook: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  ),
  tiktok: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
  ),
  youtube: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
  ),
  twitter: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  ),
};

const SocialBrandColors: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#000000',
};

export function Header() {
  const { config } = useConfig();
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth < 768);

  // Cores das redes: config > fallback brand colors
  const socialColors = config.socialMediaColors || {};
  const getSocialColor = (network: string) => {
    return (socialColors as any)[network] || SocialBrandColors[network] || config.themeColor || '#d97706';
  };

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const currentLogo = config.logoUrl || logoImage;
  const themeColor = config.themeColor || '#d97706';
  const effectShape = config.headerEffectShape || 'star';
  const effectCount = config.headerEffectCount ?? 3;
  const randomPosition = config.headerEffectRandomPosition ?? false;
  const randomSeed = config.headerEffectRandomSeed ?? 12345;
  const social = config.socialMedia || {};

  // Escolher imagem do header por dispositivo
  const currentBg = (isMobile && config.headerBackgroundMobileUrl) 
    ? config.headerBackgroundMobileUrl 
    : (config.headerBackgroundUrl || headerBg);

  const EffectIcon = {
    star: Star, heart: Heart, sparkles: Sparkles, zap: Zap,
    snowflake: Snowflake, flame: Flame, music: Music, sun: Sun,
    moon: Moon, circle: Circle, cloud: Cloud
  }[effectShape] || Star;

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

  const generateRandomPosition = (index: number) => {
    const seed = (randomSeed + index) * 1234;
    const topBottom = seed % 2 === 0 ? 'top' : 'bottom';
    const leftRight = seed % 3 === 0 ? 'left' : 'right';
    const position = 10 + (seed % 70);
    const sizes = ['w-5 h-5', 'w-6 h-6', 'w-7 h-7', 'w-8 h-8'];
    const size = sizes[seed % sizes.length];
    const opacity = 0.2 + (seed % 10) / 100;
    const delay = `${(seed % 15) / 10}s`;
    return { [topBottom]: `${position}%`, [leftRight]: `${position}%`, size, opacity, delay };
  };

  const effects = Array.from({ length: Math.min(Math.max(effectCount, 0), 15) }, (_, i) => {
    if (randomPosition) return generateRandomPosition(i);
    return predefinedPositions[i] || predefinedPositions[0];
  });

  const activeSocials = Object.entries(social).filter(([_, url]) => url && url.trim());

  return (
    <header className="relative overflow-hidden">
      {/* Imagem de fundo */}
      <div 
        className="absolute inset-0"
        style={{ backgroundImage: `url(${currentBg})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}
      />
      
      {/* Overlay: escurece acima, fade to transparent embaixo */}
      <div className="absolute inset-0" style={{ 
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.15) 85%, transparent 100%)' 
      }} />

      {/* Efeitos animados (configuráveis no admin) */}
      {effects.map((effect, index) => (
        <div
          key={index}
          className={`absolute animate-pulse ${effect.size}`}
          style={{
            color: themeColor, opacity: effect.opacity, animationDelay: effect.delay,
            ...Object.fromEntries(Object.entries(effect).filter(([key]) => ['top', 'bottom', 'left', 'right'].includes(key))),
          }}
        >
          <EffectIcon className="w-full h-full fill-current" />
        </div>
      ))}

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-10 relative z-10">
        {/* Logo centralizado */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl scale-110 animate-pulse" style={{ backgroundColor: themeColor, opacity: 0.3 }} />
            <img 
              src={currentLogo} 
              alt={config.siteName || "Logo"} 
              className="h-72 w-auto object-contain drop-shadow-[0_0_25px_rgba(251,191,36,0.5)] relative z-10"
            />
          </div>
        </div>

        {/* Linha decorativa */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${themeColor})` }} />
          <Star className="w-4 h-4" style={{ fill: themeColor, color: themeColor }} />
          <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${themeColor})` }} />
        </div>

        {/* Contato esquerda | Redes sociais direita */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-between gap-4 max-w-3xl mx-auto">
          
          {/* Contato e Endereço */}
          <div className="flex flex-col items-center lg:items-start gap-2.5">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg" style={{ backgroundColor: themeColor }}>
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-extrabold text-white tracking-wide" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
                {config.phone || '(64) 99339-2970'}
              </span>
            </div>

            <div className="inline-flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-start mt-0.5 shadow-lg" style={{ backgroundColor: themeColor }}>
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col items-center lg:items-start">
                {(config.address || 'Praça Lucio Prado - Goiatuba/GO').split(/,| - |\\n/).filter((line: string) => line.trim()).map((line: string, i: number) => (
                  <span key={i} className="text-sm font-extrabold text-white tracking-wide leading-snug" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
                    {line.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Redes Sociais */}
          {activeSocials.length > 0 && (
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 mt-1">
              {activeSocials.map(([network, url]) => {
                const Icon = SocialIcons[network];
                if (!Icon) return null;
                const label = network.charAt(0).toUpperCase() + network.slice(1);
                return (
                  <a
                    key={network}
                    href={url!.startsWith('http') ? url! : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 hover:shadow-lg"
                    style={{ backgroundColor: getSocialColor(network) }}
                    title={label}
                  >
                    <Icon className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white">{label}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
