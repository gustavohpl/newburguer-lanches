import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Menu, MapPin } from 'lucide-react';
import { useConfig } from '../../ConfigContext';

/**
 * RevealHero — Hero com "holofote" que segue o cursor.
 *
 * Técnica (baseada na spec): duas camadas da imagem sobrepostas.
 * - Camada base: imagem levemente escurecida.
 * - Camada de revelação: a MESMA imagem em vibração total, visível apenas
 *   dentro de um círculo suave (máscara radial via canvas) que segue o cursor.
 * Resultado: o cursor "acende" a comida, com brilho difuso nas bordas.
 *
 * No mobile/touch, a máscara também segue o toque e, quando ocioso,
 * desliza suavemente sozinha para o efeito nunca ficar parado.
 */

const SPOTLIGHT_R = 260;

interface RevealHeroProps {
  /** Imagem base (opcional). Padrão: headerBackgroundUrl do config. */
  baseImage?: string;
  /** Imagem revelada no holofote (opcional). Padrão: mesma da base. */
  revealImage?: string;
}

/** Camada que desenha a máscara radial no cursor e revela a imagem. */
function RevealLayer({ image, cursorX, cursorY }: { image: string; cursorX: number; cursorY: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mask, setMask] = useState<string>('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, SPOTLIGHT_R);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.4)');
    g.addColorStop(0.88, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, SPOTLIGHT_R, 0, Math.PI * 2);
    ctx.fill();

    setMask(canvas.toDataURL());
  }, [cursorX, cursorY]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ display: 'none' }} />
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat z-30 pointer-events-none"
        style={{
          backgroundImage: `url(${image})`,
          maskImage: mask ? `url(${mask})` : undefined,
          WebkitMaskImage: mask ? `url(${mask})` : undefined,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
        }}
      />
    </>
  );
}

export function RevealHero({ baseImage, revealImage }: RevealHeroProps) {
  const { config } = useConfig();
  const gold = config.themeColor || '#e8702a';
  const logo = config.logoUrl;
  const siteName = config.siteName || 'NewBurguer Lanches';

  const base = baseImage || (config as any).headerBackgroundUrl || (config as any).contentBackgroundUrl || '';
  const reveal = revealImage || base;

  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>();
  const lastMove = useRef<number>(0);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });

  const onPointerMove = useCallback((e: PointerEvent) => {
    mouse.current = { x: e.clientX, y: e.clientY };
    lastMove.current = performance.now();
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);

    const loop = () => {
      const now = performance.now();
      // Auto-drift quando ocioso (útil no mobile) após 1.5s sem mover
      if (now - lastMove.current > 1500) {
        const t = now / 1000;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight * 0.55;
        mouse.current = {
          x: cx + Math.sin(t * 0.7) * window.innerWidth * 0.28,
          y: cy + Math.cos(t * 0.9) * window.innerHeight * 0.14,
        };
      }
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1;
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1;
      setCursorPos({ x: smooth.current.x, y: smooth.current.y });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onPointerMove]);

  const navItems = ['Início', 'Cardápio', 'Combos', 'Sobre', 'Contato'];

  return (
    <div className="min-h-screen bg-white tracking-[-0.02em]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Estilos escopados (fontes, keyframes) — não mexem no CSS global */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@1,400;1,500;1,600&display=swap');
        .rv-playfair { font-family: 'Playfair Display', serif; }
        @keyframes rvReveal { 0%{opacity:0;transform:translateY(28px);filter:blur(12px)} 100%{opacity:1;transform:translateY(0);filter:blur(0)} }
        @keyframes rvFadeUp { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes rvZoom { 0%{transform:scale(1.12)} 100%{transform:scale(1)} }
        .rv-anim { opacity:0; animation-fill-mode:forwards; animation-timing-function:cubic-bezier(0.16,1,0.3,1); }
        .rv-reveal { animation-name:rvReveal; animation-duration:1.1s; }
        .rv-fade { animation-name:rvFadeUp; animation-duration:1s; }
        .rv-zoom { animation:rvZoom 1.8s cubic-bezier(0.16,1,0.3,1) forwards; }
        @media (prefers-reduced-motion: reduce){ .rv-anim,.rv-zoom{ animation:none; opacity:1; } }
      ` }} />

      {/* NAV fixa */}
      <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 sm:p-5">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={siteName} className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-white text-2xl rv-playfair italic">{siteName}</span>
          )}
        </div>
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-2 py-2 items-center gap-1">
          {navItems.map((item, i) => (
            <button
              key={item}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                i === 0 ? 'text-white bg-white/20' : 'text-white/80 hover:bg-white/20 hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          className="hidden md:block text-gray-900 text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
          style={{ backgroundColor: '#fff' }}
        >
          Peça agora
        </button>
        <button className="md:hidden p-2 rounded-lg" aria-label="Menu">
          <Menu className="w-6 h-6 text-white" />
        </button>
      </nav>

      {/* HERO */}
      <section className="relative w-full overflow-hidden h-screen bg-black" style={{ height: '100dvh' }}>
        {/* 1) Imagem base (escurecida) */}
        <div
          className="absolute inset-0 bg-center bg-cover bg-no-repeat z-10 rv-zoom"
          style={{
            backgroundImage: base ? `url(${base})` : 'linear-gradient(135deg,#2a1a10,#0d0b0a)',
            filter: 'brightness(0.5) saturate(0.85)',
          }}
        />

        {/* 2) Camada de revelação (holofote) */}
        {base && <RevealLayer image={reveal} cursorX={cursorPos.x} cursorY={cursorPos.y} />}

        {/* 3) Título */}
        <div className="absolute top-[14%] left-0 right-0 z-50 flex flex-col items-center text-center px-5 pointer-events-none">
          <h1 className="text-white leading-[0.95]">
            <span className="block rv-playfair italic font-normal text-5xl sm:text-7xl md:text-8xl rv-anim rv-reveal" style={{ letterSpacing: '-0.05em', animationDelay: '0.25s' }}>
              Sabor de verdade,
            </span>
            <span className="block font-normal text-5xl sm:text-7xl md:text-8xl -mt-1 rv-anim rv-reveal" style={{ letterSpacing: '-0.08em', animationDelay: '0.42s' }}>
              feito pra você
            </span>
          </h1>
        </div>

        {/* 4) Parágrafo inferior-esquerdo */}
        <div className="hidden sm:block absolute bottom-14 left-10 md:left-14 max-w-[260px] z-50 rv-anim rv-fade" style={{ animationDelay: '0.7s' }}>
          <p className="text-sm text-white/80 leading-relaxed">
            Hambúrgueres artesanais montados na hora, com pão brioche, carne suculenta e ingredientes selecionados a cada mordida.
          </p>
        </div>

        {/* 5) Bloco inferior-direito */}
        <div className="absolute bottom-10 sm:bottom-24 left-5 right-5 sm:left-auto sm:right-10 md:right-14 max-w-full sm:max-w-[260px] z-50 flex flex-col items-start gap-4 sm:gap-5 rv-anim rv-fade" style={{ animationDelay: '0.85s' }}>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            Passe o cursor sobre o hambúrguer e sinta o sabor "acender". Peça pelo cardápio e receba do seu jeito.
          </p>
          <button
            className="text-white text-sm font-medium px-7 py-3 rounded-full transition-all hover:scale-[1.03] active:scale-95 hover:shadow-lg"
            style={{ backgroundColor: gold, boxShadow: `0 8px 24px ${gold}4d` }}
          >
            Ver cardápio
          </button>
        </div>
      </section>
    </div>
  );
}
