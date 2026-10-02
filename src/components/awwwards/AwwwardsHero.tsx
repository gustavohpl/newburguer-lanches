import React, { useRef, useState, useEffect } from 'react';
import { Loader } from '@react-three/drei';
import { BurgerScene } from './BurgerScene';
import { useScrollAnimation } from './useScrollAnimation';
import { useConfig } from '../../ConfigContext';

/** Detecta a preferência de menos movimento (reativa a mudanças no SO). */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * AwwwardsHero — página de demonstração do Hero 3D.
 *
 * Layout:
 * - Uma seção "sticky" (o Hero) que segura o hambúrguer fixo enquanto o usuário rola.
 * - O <Canvas> fica FIXO no fundo (z-0) e o conteúdo HTML por cima (z-10),
 *   com pointer-events desligado no canvas para preservar leitura/scroll.
 * - Área de scroll alta o suficiente para percorrer "a primeira dobra" da animação.
 */
export function AwwwardsHero() {
  const { config } = useConfig();
  const siteName = config.siteName || 'NewBurguer Lanches';
  const heroRef = useRef<HTMLDivElement>(null);
  const progress = useScrollAnimation(heroRef);
  const prefersReduced = usePrefersReducedMotion();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="bg-[#0d0b0a] text-white">
      {/* CANVAS FIXO NO FUNDO */}
      <div
        className="fixed inset-0 z-0"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <BurgerScene progress={progress} isMobile={isMobile} />
      </div>

      {/* HERO — área de scroll da animação (a "primeira dobra") */}
      <section ref={heroRef} className="relative z-10" style={{ height: '250vh' }}>
        {/* Conteúdo sticky no topo do Hero */}
        <div className="sticky top-0 h-screen flex flex-col justify-between pointer-events-none">
          {/* Topo */}
          <div className="pt-10 px-6 text-center">
            <p className="uppercase tracking-[0.4em] text-xs text-amber-300/80">{siteName}</p>
          </div>

          {/* Título grande (atrás/na frente do burger conforme layout) */}
          <div className="px-6 text-center -mt-10">
            <h1
              className="font-black uppercase leading-none"
              style={{ fontSize: 'clamp(3rem, 14vw, 9rem)', letterSpacing: '-0.02em', textShadow: '0 10px 60px rgba(0,0,0,0.6)' }}
            >
              Sabor
              <br />
              <span className="text-amber-400">de verdade</span>
            </h1>
          </div>

          {/* Rodapé do hero — dica de scroll */}
          <div className="pb-10 px-6 text-center">
            <p className={`text-white/50 text-sm ${prefersReduced ? '' : 'animate-pulse'}`}>
              role para explorar ↓
            </p>
          </div>
        </div>
      </section>

      {/* Seção seguinte — mostra que o conteúdo continua legível sobre o canvas */}
      <section className="relative z-10 min-h-screen bg-gradient-to-b from-transparent to-[#0d0b0a] flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">
            Ingredientes selecionados, <span className="text-amber-400">montados na hora.</span>
          </h2>
          <p className="text-white/60 text-lg">
            Um hambúrguer artesanal de verdade, com pão brioche, carne suculenta e aquele
            capricho que só a {siteName} tem.
          </p>
        </div>
      </section>

      {/* Loader de marca: cobre a tela enquanto o GLB + HDRI carregam
          (evita o "flash" de canvas em branco). Some sozinho ao concluir. */}
      <Loader
        containerStyles={{ background: '#0d0b0a' }}
        innerStyles={{ background: 'rgba(255,255,255,0.12)', width: '160px', height: '3px' }}
        barStyles={{ background: '#fbbf24', height: '3px' }}
        dataStyles={{ color: '#fcd34d', fontSize: '12px', letterSpacing: '0.2em', marginTop: '12px' }}
        dataInterpolation={(p) => `Preparando o pedido… ${p.toFixed(0)}%`}
      />
    </div>
  );
}
