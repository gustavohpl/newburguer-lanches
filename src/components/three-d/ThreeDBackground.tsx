import React, { useEffect, useRef, useState } from 'react';
import { useConfig } from '../../ConfigContext';
import { BurgerScene } from '../awwwards/BurgerScene';

/**
 * Fundo do design "3D".
 *
 * Substitui a imagem de fundo fixa do Clássico pela cena 3D do hambúrguer.
 * É apenas um efeito de fundo (fixed, atrás de todo o conteúdo Clássico):
 * o header, os menus e o footer do Clássico ficam por cima, transparentes,
 * deixando o 3D aparecer — inclusive atrás da logo do header.
 *
 * A rotação do modelo acompanha suavemente o scroll da página (0 → 360°),
 * sem "wrap" brusco. Respeita prefers-reduced-motion (fica estático).
 */
export function ThreeDBackground() {
  const { config } = useConfig();
  const progress = useRef(0);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  const gold = config.themeColor || '#fbbf24';

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Rotação ligada ao scroll (monotônica, sem re-render).
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      progress.current = 0;
      return;
    }
    let raf = 0;
    const tick = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      // Lerp suave em direção ao alvo do scroll
      progress.current += (p - progress.current) * 0.1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden
      style={{ backgroundColor: '#0d0b0a' }}
    >
      {/* Camadas de profundidade: glow âmbar quente + vinheta nas bordas */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(60% 55% at 50% 42%, ${gold}22, transparent 70%)` }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)' }}
      />
      {/* Cena 3D do hambúrguer */}
      <div className="absolute inset-0">
        <BurgerScene progress={progress} isMobile={isMobile} />
      </div>
    </div>
  );
}
