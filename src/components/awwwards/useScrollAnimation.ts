import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * ScrollAnimation:
 * - Inicializa o Lenis (scroll suave) e integra com o GSAP ScrollTrigger.
 * - Cria um ScrollTrigger com `scrub` que escreve o progresso (0→1) num ref.
 *   Esse ref é lido dentro do useFrame (Burger/Camera/Lights) para animar em 60fps.
 *
 * @param triggerRef  elemento que define a área de scroll da animação (o Hero).
 * @returns progress  ref com o progresso do scroll (0 a 1).
 */
/** Pose fixa (agradável) usada quando o usuário pede menos movimento. */
const REDUCED_MOTION_POSE = 0.12;

export function useScrollAnimation(triggerRef: React.RefObject<HTMLElement>) {
  const progress = useRef(0);

  useEffect(() => {
    // Acessibilidade: se o usuário prefere menos movimento, não iniciamos
    // Lenis nem o ScrollTrigger. Congelamos a cena numa pose bonita e fixa.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      progress.current = REDUCED_MOTION_POSE;
      return;
    }

    // 1) Scroll suave com Lenis
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });

    // Integração Lenis <-> ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    const ticker = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    // 2) ScrollTrigger que preenche o progress (0→1) ao longo do Hero
    const st = ScrollTrigger.create({
      trigger: triggerRef.current || undefined,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        progress.current = self.progress;
      },
    });

    return () => {
      st.kill();
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, [triggerRef]);

  return progress;
}
