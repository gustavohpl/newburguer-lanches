import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import { Lights } from './Lights';
import { CameraRig } from './CameraRig';
import { Burger } from './Burger';

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
      shadows
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 1.6, 6], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Lights progress={progress} />

        <EnvBoundary>
          <Suspense fallback={null}>
            <Environment preset="sunset" />
          </Suspense>
        </EnvBoundary>

        <CameraRig progress={progress} />
        <Burger progress={progress} />

        <ContactShadows
          position={[0, -1.4, 0]}
          opacity={0.55}
          scale={10}
          blur={2.6}
          far={4}
          resolution={isMobile ? 256 : 512}
          color="#000000"
        />
      </Suspense>
    </Canvas>
  );
}
