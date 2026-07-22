import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import { Lights } from './Lights';
import { CameraRig } from './CameraRig';
import { Burger } from './Burger';
import { HeroEffects } from './HeroEffects';

interface BurgerSceneProps {
  progress: React.MutableRefObject<number>;
  isMobile: boolean;
}

/**
 * ErrorBoundary do ambiente HDRI: presets do drei carregam de um CDN.
 * Se falhar (offline/bloqueado), a cena continua só com as luzes.
 */
class EnvBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? null : <>{this.props.children}</>; }
}

/**
 * Cena 3D do hambúrguer.
 * - Canvas com sombras, dpr limitado (performance no mobile)
 * - Environment HDRI (com fallback para só-luzes)
 * - ContactShadows suaves no chão
 * - CameraRig (órbita) + Lights (reagem ao scroll) + Burger (gira)
 */
export function BurgerScene({ progress, isMobile }: BurgerSceneProps) {
  return (
    <Canvas
      // No mobile: sem shadow maps e dpr travado em 1 → fluidez durante o scroll.
      shadows={!isMobile}
      dpr={isMobile ? 1 : [1, 2]}
      // Deixa o R3F regredir a resolução se o frame cair (adaptativo).
      performance={{ min: 0.5 }}
      camera={{ position: [0, 1.6, isMobile ? 5.7 : 6], fov: 40 }}
      gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Lights progress={progress} />

        <EnvBoundary>
          <Suspense fallback={null}>
            <Environment preset="sunset" />
          </Suspense>
        </EnvBoundary>

        <CameraRig progress={progress} isMobile={isMobile} />
        <Burger progress={progress} />
        <HeroEffects isMobile={isMobile} />

        {/* ContactShadows é caro no mobile (render de textura extra por frame):
            só no desktop. No mobile a vinheta do fundo já dá profundidade. */}
        {!isMobile && (
          <ContactShadows
            position={[0, -1.4, 0]}
            opacity={0.55}
            scale={10}
            blur={2.6}
            far={4}
            resolution={512}
            color="#000000"
          />
        )}
      </Suspense>
    </Canvas>
  );
}
